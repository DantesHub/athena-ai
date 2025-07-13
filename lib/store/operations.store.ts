import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { writeBatch, doc, serverTimestamp, deleteField, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Operation, OperationQueueState } from '@/lib/types/operations';
import { NodeService } from '@/lib/firebase/services/node.service';

const FLUSH_DELAY = 250; // 250ms debounce
const MAX_BATCH_SIZE = 400; // Stay under Firestore's 500 limit

export const useOperationsStore = create<OperationQueueState>()(
  devtools(
    (set, get) => ({
      operations: [],
      flushTimer: null,
      isProcessing: false,

      addOperation: (op: Operation) => {
        console.log('🔄 Adding operation to queue:', op.kind, op);
        
        set((state) => {
          // Clear existing timer
          if (state.flushTimer) {
            clearTimeout(state.flushTimer);
          }

          // Add operation to queue
          const newOperations = [...state.operations, op];

          // Set new debounced timer
          const flushTimer = setTimeout(() => {
            console.log('⏰ Debounce timer fired, flushing operations');
            get().flushOperations();
          }, FLUSH_DELAY);
          
          console.log('⏲️ Timer set for', FLUSH_DELAY, 'ms, queue size:', newOperations.length);

          return {
            operations: newOperations,
            flushTimer,
          };
        });

        // If queue is getting large, flush immediately
        if (get().operations.length >= MAX_BATCH_SIZE) {
          console.log('⚡ Queue full, flushing immediately');
          get().flushOperations();
        }
      },
      
      addOperations: (ops: Operation[]) => {
        console.log('🔄 Adding', ops.length, 'operations to queue');
        
        set((state) => {
          // Clear existing timer
          if (state.flushTimer) {
            clearTimeout(state.flushTimer);
          }

          // Add all operations to queue
          const newOperations = [...state.operations, ...ops];

          // Set new debounced timer
          const flushTimer = setTimeout(() => {
            console.log('⏰ Debounce timer fired, flushing operations');
            get().flushOperations();
          }, FLUSH_DELAY);
          
          console.log('⏲️ Timer set for', FLUSH_DELAY, 'ms, queue size:', newOperations.length);

          return {
            operations: newOperations,
            flushTimer,
          };
        });

        // If queue is getting large, flush immediately
        if (get().operations.length >= MAX_BATCH_SIZE) {
          console.log('⚡ Queue full, flushing immediately');
          get().flushOperations();
        }
      },

      flushOperations: async () => {
        const state = get();
        
        // Skip if already processing or no operations
        if (state.isProcessing) {
          console.log('⏭️ Already processing, skipping flush');
          return;
        }
        
        if (state.operations.length === 0) {
          console.log('⏭️ No operations to flush');
          return;
        }

        console.log('🚀 Flushing', state.operations.length, 'operations to Firestore');
        set({ isProcessing: true });

        try {
          // Group operations by workspace for better batching
          const operationsByWorkspace = new Map<string, Operation[]>();
          
          for (const op of state.operations) {
            const wsId = op.workspaceId;
            if (!operationsByWorkspace.has(wsId)) {
              operationsByWorkspace.set(wsId, []);
            }
            operationsByWorkspace.get(wsId)!.push(op);
          }

          // Process each workspace's operations
          for (const [workspaceId, ops] of operationsByWorkspace) {
            // Chunk operations to stay under batch limit
            const chunks = chunkArray(ops, MAX_BATCH_SIZE);
            
            for (const chunk of chunks) {
              const batch = writeBatch(db);
              
              // First, handle deleteAll operations before other operations
              const deleteAllOps = chunk.filter(op => op.kind === 'deleteAll');
              const otherOps = chunk.filter(op => op.kind !== 'deleteAll');
              
              // Process deleteAll operations first
              for (const deleteOp of deleteAllOps) {
                if (deleteOp.kind === 'deleteAll') {
                  await handleDeleteAll(deleteOp.workspaceId, deleteOp.pageId);
                }
              }
              
              // Then process other operations if any
              if (otherOps.length > 0) {
                for (const op of otherOps) {
                  switch (op.kind) {
                    case 'create': {
                      const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', op.nodeId);
                      batch.set(nodeRef, {
                        ...op.node,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                      });
                      break;
                    }
                    
                    case 'update': {
                      const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', op.nodeId);
                      batch.update(nodeRef, {
                        ...op.delta,
                        updatedAt: serverTimestamp(),
                      });
                      break;
                    }
                    
                    case 'delete': {
                      const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', op.nodeId);
                      // Hard delete - actually remove the document
                      batch.delete(nodeRef);
                      console.log('🗑️ Hard deleting block:', op.nodeId);
                      break;
                    }
                  }
                }
                
                // Commit the batch only if there are operations
                await batch.commit();
                console.log('✅ Batch committed successfully');
              }
            }
          }

          // Clear the queue
          set({ 
            operations: [], 
            isProcessing: false,
            flushTimer: null 
          });
          
        } catch (error) {
          console.error('❌ Failed to flush operations:', error);
          set({ isProcessing: false });
          // Keep operations in queue for retry
        }
      },

      clearQueue: () => {
        const state = get();
        if (state.flushTimer) {
          clearTimeout(state.flushTimer);
        }
        set({ 
          operations: [], 
          flushTimer: null,
          isProcessing: false 
        });
      },
    }),
    {
      name: 'operations-queue',
    }
  )
);

// Helper function to chunk array
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Handle deleteAll operation
async function handleDeleteAll(workspaceId: string, pageId: string) {
  console.log('🗑️ Handling deleteAll for page:', pageId);
  
  try {
    // Get all child blocks (including already soft-deleted ones)
    const blocksQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      where('parentId', '==', pageId)
    );
    
    const blocksSnap = await getDocs(blocksQuery);
    const blocks = blocksSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('📊 Found', blocks.length, 'total blocks to delete (including any already deleted)');
    
    if (blocks.length === 0) {
      console.log('⚠️ No blocks found to delete');
      return;
    }
    
    // Chunk and soft delete all blocks
    const chunks = chunkArray(blocks, MAX_BATCH_SIZE);
    
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      
      for (const block of chunk) {
        const blockRef = doc(db, 'workspaces', workspaceId, 'nodes', block.id);
        // Hard delete - actually remove the document
        batch.delete(blockRef);
        console.log('🗑️ Hard deleting block:', block.id);
      }
      
      await batch.commit();
      console.log('✅ Batch of', chunk.length, 'blocks DELETED from Firestore');
    }
    
    console.log('✅ Successfully DELETED', blocks.length, 'blocks from Firestore');
  } catch (error) {
    console.error('❌ Failed to delete all blocks:', error);
    throw error;
  }
}

// Setup beforeunload handler
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', async (e) => {
    const store = useOperationsStore.getState();
    if (store.operations.length > 0) {
      // Try to flush operations before leaving
      await store.flushOperations();
    }
  });
}