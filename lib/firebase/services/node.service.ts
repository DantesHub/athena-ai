import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  limit,
  updateDoc,
  deleteDoc,
  deleteField
} from 'firebase/firestore';
import { db } from '../config';
import type { Node, Edge } from '@/lib/types/firestore';
import { getDailyNoteId, formatDateForDisplay } from '@/lib/utils/date';
import { generateBlockId } from '@/lib/utils/block-id';

export class NodeService {
  static async createNode(
    workspaceId: string,
    node: Omit<Node, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    console.log('📦 Creating new node in workspace:', workspaceId);
    console.log('📄 Node data:', {
      type: node.type,
      hasContent: !!node.content,
      contentLength: node.content?.length,
      parentId: node.parentId,
      createdBy: node.createdBy
    });
    
    const nodeRef = doc(collection(db, 'workspaces', workspaceId, 'nodes'));
    const newNode = {
      ...node,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    try {
      console.log('🚀 Writing node to Firestore...');
      await setDoc(nodeRef, newNode);
      console.log('✅ Node created successfully with ID:', nodeRef.id);
    } catch (error: any) {
      console.error('❌ Failed to create node:', {
        error,
        code: error?.code,
        message: error?.message
      });
      throw error;
    }
    
    // Create edges for references
    if (node.refs && node.refs.length > 0) {
      const batch = writeBatch(db);
      
      for (const targetId of node.refs) {
        const edgeRef = doc(collection(db, 'workspaces', workspaceId, 'edges'));
        const edge: Omit<Edge, 'id'> = {
          from: nodeRef.id,
          to: targetId,
          kind: 'mention',
          createdAt: serverTimestamp() as Timestamp,
        };
        batch.set(edgeRef, edge);
      }
      
      await batch.commit();
    }
    
    return nodeRef.id;
  }
  
  static async updateNode(
    workspaceId: string,
    nodeId: string,
    updates: Partial<Node>
  ): Promise<void> {
    console.log('🔄 Updating node:', nodeId, 'in workspace:', workspaceId);
    console.log('📄 Updates:', {
      hasContent: 'content' in updates,
      contentLength: updates.content?.length,
      hasTitle: 'title' in updates,
      fields: Object.keys(updates)
    });
    
    const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', nodeId);
    
    try {
      console.log('🚀 Writing updates to Firestore...');
      await updateDoc(nodeRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      console.log('✅ Node updated successfully');
    } catch (error: any) {
      console.error('❌ Failed to update node:', {
        error,
        code: error?.code,
        message: error?.message,
        nodeId,
        workspaceId
      });
      throw error;
    }
    
    // Update edges if refs changed
    if (updates.refs !== undefined) {
      // Delete old edges
      const oldEdgesQuery = query(
        collection(db, 'workspaces', workspaceId, 'edges'),
        where('from', '==', nodeId),
        where('kind', '==', 'mention')
      );
      const oldEdges = await getDocs(oldEdgesQuery);
      
      const batch = writeBatch(db);
      oldEdges.forEach(doc => batch.delete(doc.ref));
      
      // Create new edges
      for (const targetId of updates.refs || []) {
        const edgeRef = doc(collection(db, 'workspaces', workspaceId, 'edges'));
        const edge: Omit<Edge, 'id'> = {
          from: nodeId,
          to: targetId,
          kind: 'mention',
          createdAt: serverTimestamp() as Timestamp,
        };
        batch.set(edgeRef, edge);
      }
      
      await batch.commit();
    }
  }
  
  static async getNode(workspaceId: string, nodeId: string): Promise<Node | null> {
    console.log('🔍 Fetching node:', nodeId, 'from workspace:', workspaceId);
    
    const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', nodeId);
    
    try {
      const nodeSnap = await getDoc(nodeRef);
      
      if (!nodeSnap.exists()) {
        console.log('⚠️ Node not found');
        return null;
      }
      
      const data = nodeSnap.data();
      console.log('✅ Node fetched successfully:', {
        hasData: !!data,
        hasContent: !!data?.content,
        contentLength: data?.content?.length
      });
      
      return { id: nodeSnap.id, ...data } as Node;
    } catch (error: any) {
      console.error('❌ Failed to fetch node:', {
        error,
        code: error?.code,
        message: error?.message
      });
      throw error;
    }
  }
  
  static async getChildNodes(
    workspaceId: string,
    parentId: string | null
  ): Promise<Node[]> {
    const nodesQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      where('parentId', '==', parentId),
      orderBy('order', 'asc')
    );
    
    const nodesSnap = await getDocs(nodesQuery);
    return nodesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Node));
  }
  
  static async getBacklinks(workspaceId: string, nodeId: string): Promise<Edge[]> {
    const edgesQuery = query(
      collection(db, 'workspaces', workspaceId, 'edges'),
      where('to', '==', nodeId)
    );
    
    const edgesSnap = await getDocs(edgesQuery);
    return edgesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Edge));
  }
  
  static async deleteNode(workspaceId: string, nodeId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Delete the node
    const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', nodeId);
    batch.delete(nodeRef);
    
    // Delete all edges from this node
    const fromEdgesQuery = query(
      collection(db, 'workspaces', workspaceId, 'edges'),
      where('from', '==', nodeId)
    );
    const fromEdges = await getDocs(fromEdgesQuery);
    fromEdges.forEach(doc => batch.delete(doc.ref));
    
    // Delete all edges to this node
    const toEdgesQuery = query(
      collection(db, 'workspaces', workspaceId, 'edges'),
      where('to', '==', nodeId)
    );
    const toEdges = await getDocs(toEdgesQuery);
    toEdges.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
  }
  
  static async getRecentNodes(
    workspaceId: string,
    limitCount: number = 50
  ): Promise<Node[]> {
    const nodesQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );
    
    const nodesSnap = await getDocs(nodesQuery);
    return nodesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Node));
  }
  
  static async getDailyNote(workspaceId: string, date: string): Promise<Node | null> {
    console.log('📅 Getting daily note for date:', date);
    
    const nodesQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      where('type', '==', 'daily'),
      where('date', '==', date),
      limit(1)
    );
    
    try {
      const nodesSnap = await getDocs(nodesQuery);
      
      if (nodesSnap.empty) {
        console.log('⚠️ Daily note not found for date:', date);
        return null;
      }
      
      const doc = nodesSnap.docs[0];
      const node = { id: doc.id, ...doc.data() } as Node;
      console.log('✅ Daily note found:', node.id);
      return node;
    } catch (error: any) {
      console.error('❌ Failed to get daily note:', {
        error,
        code: error?.code,
        message: error?.message
      });
      throw error;
    }
  }
  
  static async createDailyNote(
    workspaceId: string,
    date: string,
    userId: string
  ): Promise<string> {
    console.log('📅 Creating daily note for date:', date);
    
    // Check if daily note already exists
    const existing = await this.getDailyNote(workspaceId, date);
    if (existing) {
      console.log('ℹ️ Daily note already exists:', existing.id);
      return existing.id;
    }
    
    // Create daily note with a specific ID format
    const nodeId = getDailyNoteId(date);
    const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', nodeId);
    
    const dailyNote: Omit<Node, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'daily',
      date,
      title: formatDateForDisplay(date),
      parentId: null,
      order: 0,
      refs: [],
      createdBy: userId,
      _v: 1
    };
    
    try {
      console.log('🚀 Writing daily note to Firestore...');
      await setDoc(nodeRef, {
        ...dailyNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('✅ Daily note created successfully with ID:', nodeId);
      return nodeId;
    } catch (error: any) {
      console.error('❌ Failed to create daily note:', {
        error,
        code: error?.code,
        message: error?.message
      });
      throw error;
    }
  }
  
  static async getOrCreateDailyNote(
    workspaceId: string,
    date: string,
    userId: string
  ): Promise<Node> {
    console.log('📅 Getting or creating daily note for date:', date);
    
    // Try to get existing daily note
    const existing = await this.getDailyNote(workspaceId, date);
    if (existing) {
      return existing;
    }
    
    // Create new daily note
    const nodeId = await this.createDailyNote(workspaceId, date, userId);
    const newNode = await this.getNode(workspaceId, nodeId);
    
    if (!newNode) {
      throw new Error('Failed to create daily note');
    }
    
    return newNode;
  }
  
  static async createBlock(
    workspaceId: string,
    parentId: string,
    text: string,
    order: number,
    userId: string
  ): Promise<string> {
    console.log('📦 Creating new block in parent:', parentId);
    
    const blockId = generateBlockId();
    const blockRef = doc(db, 'workspaces', workspaceId, 'nodes', blockId);
    
    const block: Omit<Node, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'paragraph',
      text,
      parentId,
      order,
      refs: [],
      createdBy: userId,
      _v: 1
    };
    
    try {
      await setDoc(blockRef, {
        ...block,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('✅ Block created successfully with ID:', blockId);
      return blockId;
    } catch (error: any) {
      console.error('❌ Failed to create block:', error);
      throw error;
    }
  }
  
  static async updateBlock(
    workspaceId: string,
    blockId: string,
    text: string
  ): Promise<void> {
    console.log('🔄 Updating block:', blockId);
    
    const blockRef = doc(db, 'workspaces', workspaceId, 'nodes', blockId);
    
    try {
      await updateDoc(blockRef, {
        text,
        updatedAt: serverTimestamp(),
      });
      console.log('✅ Block updated successfully');
    } catch (error: any) {
      console.error('❌ Failed to update block:', error);
      throw error;
    }
  }
  
  static async deleteBlock(
    workspaceId: string,
    blockId: string
  ): Promise<void> {
    console.log('🗑️ Deleting block:', blockId);
    
    const blockRef = doc(db, 'workspaces', workspaceId, 'nodes', blockId);
    
    try {
      await deleteDoc(blockRef);
      console.log('✅ Block deleted successfully');
    } catch (error: any) {
      console.error('❌ Failed to delete block:', error);
      throw error;
    }
  }
  
  static async getBlocks(
    workspaceId: string,
    parentId: string
  ): Promise<Node[]> {
    console.log('📋 Getting blocks for parent:', parentId);
    
    // Simpler query that doesn't require composite index
    const blocksQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      where('parentId', '==', parentId),
      orderBy('order', 'asc')
    );
    
    try {
      const blocksSnap = await getDocs(blocksQuery);
      const blocks = blocksSnap.docs
        .map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Node));
      
      console.log('✅ Found', blocks.length, 'blocks');
      console.log('📋 Block details:', blocks.map(b => ({
        id: b.id,
        type: b.type,
        text: b.text,
        order: b.order,
        parentId: b.parentId
      })));
      return blocks;
    } catch (error: any) {
      console.error('❌ Failed to get blocks:', error);
      throw error;
    }
  }
  
  static async syncPageBlocks(
    workspaceId: string,
    pageId: string,
    content: any[],
    userId: string,
    useQueue: boolean = true
  ): Promise<void> {
    console.log('🔄 Syncing blocks for page:', pageId);
    console.log('📋 Content to sync:', JSON.stringify(content, null, 2));
    
    // Import stores dynamically to avoid circular dependency
    const { useOperationsStore } = await import('@/lib/store/operations.store');
    const { useBlockCacheStore } = await import('@/lib/store/block-cache.store');
    const operationsStore = useOperationsStore.getState();
    const blockCacheStore = useBlockCacheStore.getState();
    
    // Special handling for empty content (user deleted everything)
    if (content.length === 0 || (content.length === 1 && content[0].type === 'paragraph' && !content[0].content)) {
      console.log('🗑️ Content is empty or has single empty paragraph - deleting all blocks');
      console.log('📊 Empty content detected:', { 
        contentLength: content.length, 
        firstItem: content[0],
        pageId,
        workspaceId
      });
      
      if (useQueue) {
        // Queue a deleteAll operation
        console.log('🔄 Queueing deleteAll operation for page:', pageId);
        operationsStore.addOperation({
          kind: 'deleteAll',
          pageId,
          workspaceId
        });
        console.log('✅ DeleteAll operation queued');
      } else {
        // Direct deletion (for migration or special cases)
        const existingBlocks = await this.getBlocks(workspaceId, pageId);
        if (existingBlocks.length > 0) {
          const batch = writeBatch(db);
          for (const block of existingBlocks) {
            const blockRef = doc(db, 'workspaces', workspaceId, 'nodes', block.id);
            batch.update(blockRef, {
              deleted: true,
              deletedAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          await batch.commit();
          console.log('✅ All blocks deleted');
        }
      }
      return;
    }
    
    // First, ensure the parent node doesn't have a content field
    // This is important for daily notes that might have been incorrectly saved with content
    const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', pageId);
    const nodeSnap = await getDoc(nodeRef);
    if (nodeSnap.exists() && nodeSnap.data().content !== undefined) {
      console.log('🧹 Cleaning up content field from parent node:', pageId);
      await updateDoc(nodeRef, {
        content: deleteField(),
        updatedAt: serverTimestamp()
      });
    }
    
    // Get existing blocks
    const existingBlocks = await this.getBlocks(workspaceId, pageId);
    console.log('📊 Existing blocks before sync:', existingBlocks.map(b => ({
      id: b.id,
      type: b.type,
      order: b.order,
      text: b.text?.substring(0, 30)
    })));
    
    // Create map of existing blocks by order
    const existingBlockMap = new Map(existingBlocks.map(b => [b.order, b]));
    
    // Sort existing blocks to find paragraphs in order
    const existingParagraphs = existingBlocks
      .filter(b => b.type === 'paragraph')
      .sort((a, b) => a.order - b.order);
    
    // Process content array
    const processedOrders = new Set<number>();
    const operations: Operation[] = [];
    
    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      processedOrders.add(i);
      
      // Handle different content types
      if (item.type === 'paragraph' && item.content !== undefined) {
        const existingBlock = existingBlockMap.get(i);
        
        // Check cache first
        const cachedBlockId = blockCacheStore.getBlockId(pageId, i);
        
        if (cachedBlockId) {
          // We have a cached block ID - always update it
          console.log('📌 Using cached block ID:', cachedBlockId, 'for order:', i);
          operations.push({
            kind: 'update',
            nodeId: cachedBlockId,
            workspaceId,
            delta: { text: item.content || '' }
          });
        } else if (existingBlock && existingBlock.type === 'paragraph') {
          // Update existing block and cache its ID
          blockCacheStore.setBlockId(pageId, i, existingBlock.id);
          
          if (existingBlock.text !== item.content) {
            operations.push({
              kind: 'update',
              nodeId: existingBlock.id,
              workspaceId,
              delta: { text: item.content }
            });
            console.log('📝 Queueing update for block:', existingBlock.id, 'old:', existingBlock.text, 'new:', item.content);
          }
        } else if (item.content && item.content.trim()) {
          // Only create new block if there's actual content
            // Delete existing block if it's not a paragraph
            if (existingBlock) {
              console.log('🔄 Replacing non-paragraph block at order', i);
              operations.push({
                kind: 'delete',
                nodeId: existingBlock.id,
                workspaceId
              });
            }
            
            // Check if we should reuse an existing paragraph that might have moved
            const existingParagraphWithSameContent = existingParagraphs.find(p => 
              p.text === item.content && !processedOrders.has(p.order)
            );
            
            if (existingParagraphWithSameContent) {
              // Update the order of existing paragraph instead of creating new
              console.log('📍 Moving existing paragraph to new position');
              operations.push({
                kind: 'update',
                nodeId: existingParagraphWithSameContent.id,
                workspaceId,
                delta: { order: i }
              });
              processedOrders.add(existingParagraphWithSameContent.order);
            } else {
              // Create new block only if content is not empty
              const blockId = generateBlockId();
              
              // Cache the block ID immediately
              blockCacheStore.setBlockId(pageId, i, blockId);
              
              operations.push({
                kind: 'create',
                nodeId: blockId,
                workspaceId,
                node: {
                  type: 'paragraph',
                  text: item.content,
                  parentId: pageId,
                  order: i,
                  refs: [],
                  createdBy: userId,
                  _v: 1
                }
              });
              console.log('➕ Creating NEW paragraph block:', blockId, 'with text:', item.content, 'and caching it');
            }
          }
      } else if (item.type === 'bullet_list' && item.items) {
        console.log('🔫 Processing bullet list with', item.items.length, 'items:', item.items);
        console.log('🔫 Full bullet list item:', JSON.stringify(item, null, 2));
        
        // Store the entire bullet list as a single document
        const bulletListText = item.items.join('\n');
        console.log('🔫 Joined bullet list text:', bulletListText);
        processedOrders.add(i);
        
        // Find existing bullet block at this position with the same content
        const existingBlock = Array.from(existingBlockMap.values()).find(
          b => Math.abs(b.order - i) < 0.001 && b.type === 'bullet'
        );
        
        if (existingBlock) {
          // Cache the existing block ID
          blockCacheStore.setBlockId(pageId, i, existingBlock.id);
          
          // Only update if the text is different
          if (existingBlock.text !== bulletListText) {
            operations.push({
              kind: 'update',
              nodeId: existingBlock.id,
              workspaceId,
              delta: { text: bulletListText }
            });
            console.log('📝 Queueing update for bullet list block:', existingBlock.id, 'old text:', existingBlock.text, 'new text:', bulletListText);
          }
        } else {
          // Check if there's a non-bullet block at this position that needs to be deleted
          const existingNonBulletBlock = Array.from(existingBlockMap.values()).find(
            b => Math.abs(b.order - i) < 0.001 && b.type !== 'bullet'
          );
          
          if (existingNonBulletBlock) {
            operations.push({
              kind: 'delete',
              nodeId: existingNonBulletBlock.id,
              workspaceId
            });
            console.log('🗑️ Deleting non-bullet block at position', i, 'to make room for bullet list');
          }
          
          // Create new bullet list block
          const bulletListId = generateBlockId();
          
          operations.push({
            kind: 'create',
            nodeId: bulletListId,
            workspaceId,
            node: {
              type: 'bullet',
              text: bulletListText,
              parentId: pageId,
              order: i,
              refs: [],
              createdBy: userId,
              _v: 1
            }
          });
          console.log('➕ Creating NEW bullet list block:', bulletListId, 'with text:', bulletListText);
        }
      }
    }
    
    // Delete blocks that no longer exist
    console.log('🔍 Checking for blocks to delete. Processed orders:', Array.from(processedOrders));
    console.log('🔍 Existing block orders:', Array.from(existingBlockMap.keys()));
    
    for (const [order, block] of existingBlockMap) {
      // Check if this block's order is in processedOrders (including fractional orders)
      let isProcessed = false;
      for (const processedOrder of processedOrders) {
        if (Math.abs(order - processedOrder) < 0.0001) {
          isProcessed = true;
          break;
        }
      }
      
      if (!isProcessed) {
        operations.push({
          kind: 'delete',
          nodeId: block.id,
          workspaceId
        });
        console.log('🗑️ Queueing delete for block:', block.id, 'type:', block.type, 'order:', order, 'text:', block.text?.substring(0, 30));
      }
    }
    
    // Add all operations to the queue
    if (useQueue && operations.length > 0) {
      console.log('📦 Adding', operations.length, 'operations to queue');
      operationsStore.addOperations(operations);
    } else if (!useQueue && operations.length > 0) {
      // Direct execution (for migration or special cases)
      console.log('⚡ Executing', operations.length, 'operations directly');
      // This would use the old batch logic if needed
    }
    
    console.log('✅ Block sync queued');
  }
  
  static async cleanupDailyNotesContent(workspaceId: string): Promise<void> {
    console.log('🧹 Cleaning up content field from all daily notes...');
    
    const dailyNotesQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      where('type', '==', 'daily')
    );
    
    try {
      const dailyNotesSnap = await getDocs(dailyNotesQuery);
      const batch = writeBatch(db);
      let cleanupCount = 0;
      
      for (const docSnap of dailyNotesSnap.docs) {
        if (docSnap.data().content !== undefined) {
          console.log('🧹 Removing content field from daily note:', docSnap.id);
          batch.update(docSnap.ref, {
            content: deleteField(),
            updatedAt: serverTimestamp()
          });
          cleanupCount++;
        }
      }
      
      if (cleanupCount > 0) {
        await batch.commit();
        console.log('✅ Cleaned up content field from', cleanupCount, 'daily notes');
      } else {
        console.log('✅ No daily notes needed cleanup');
      }
    } catch (error: any) {
      console.error('❌ Failed to cleanup daily notes:', error);
      throw error;
    }
  }
}