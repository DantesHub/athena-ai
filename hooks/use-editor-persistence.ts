import { useEffect, useCallback, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/workspace.store';
import { NodeService } from '@/lib/firebase/services/node.service';
import type { Node } from '@/lib/types/firestore';
import { debounce } from '@/lib/utils';

interface UseEditorPersistenceOptions {
  workspaceId?: string;
  nodeId?: string;
  parentId?: string | null;
  userId?: string;
}

export function useEditorPersistence({
  workspaceId,
  nodeId,
  parentId = null,
  userId = 'default-user', // No auth needed
}: UseEditorPersistenceOptions) {
  const {
    currentWorkspace,
    nodes,
    loadNode,
    createNode,
    updateNode,
    loadChildNodes,
    setLocalContent,
    getLocalContent,
    clearLocalContent,
    isSaving,
  } = useWorkspaceStore();
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const [blocks, setBlocks] = useState<Node[] | undefined>(undefined);
  const [blocksLoaded, setBlocksLoaded] = useState(false);
  const prevNodeIdRef = useRef(nodeId);
  
  // Track if blocks have been initially loaded
  const blocksLoadedRef = useRef(false);
  
  // Load node if nodeId is provided
  useEffect(() => {
    if (workspaceId && nodeId) {
      loadNode(workspaceId, nodeId);
      
      // Reset blocks loaded flag when nodeId changes
      if (nodeId !== prevNodeIdRef.current) {
        blocksLoadedRef.current = false;
      }
      
      // Load blocks for daily notes and pages only once per nodeId
      if (!blocksLoadedRef.current) {
        NodeService.getBlocks(workspaceId, nodeId).then(loadedBlocks => {
          console.log('📋 Persistence: Loaded', loadedBlocks.length, 'blocks for node', nodeId);
          console.log('📋 Persistence: Block data:', loadedBlocks.map(b => ({ id: b.id, type: b.type, text: b.text, order: b.order })));
          setBlocks(loadedBlocks);
          setBlocksLoaded(true);
          blocksLoadedRef.current = true;
        }).catch(error => {
          console.error('❌ Persistence: Failed to load blocks:', error);
          setBlocks([]);
          setBlocksLoaded(true);
        });
      }
    }
  }, [workspaceId, nodeId, loadNode]);
  
  // Load child nodes if we're viewing a parent
  useEffect(() => {
    if (workspaceId && nodeId) {
      loadChildNodes(workspaceId, nodeId);
    } else if (workspaceId) {
      // Load root nodes
      loadChildNodes(workspaceId, null);
    }
  }, [workspaceId, nodeId, loadChildNodes]);
  
  // Save content locally (to Zustand)
  const saveContentLocally = useCallback(
    (contentString: string, title?: string) => {
      if (!nodeId) {
        console.log('⚠️ Persistence: No nodeId, cannot save locally');
        return;
      }
      
      console.log('💾 Local: Saving content to Zustand for node', nodeId);
      setLocalContent(nodeId, contentString);
    },
    [nodeId, setLocalContent]
  );
  
  // Check if this is a temporary node ID
  const isTemporaryNode = nodeId?.startsWith('temp-');
  
  // Save content to Firebase (called on Enter key)
  const saveContentToFirebase = useCallback(
    async (contentString?: string, title?: string) => {
      console.log('🔥 Persistence: saveContentToFirebase called with:', {
        hasContentString: !!contentString,
        hasTitle: !!title,
        workspaceId,
        nodeId,
        userId
      });
      
      if (!workspaceId || !userId) {
        console.log('⚠️ Persistence: Missing workspaceId or userId, skipping Firebase save');
        return;
      }
      
      // Use local content if not provided
      const contentToSave = contentString || (nodeId ? getLocalContent(nodeId) : undefined);
      if (!contentToSave) {
        console.log('⚠️ Persistence: No content to save');
        return;
      }
      
      console.log('🚀 Persistence: Saving to Firebase for', nodeId ? `node ${nodeId}` : 'new node');
      console.log('📄 Persistence: Content length:', contentToSave.length);
      console.log('📄 Persistence: Content preview:', contentToSave.substring(0, 200));
      
      try {
        // Parse the content string to get the actual content array
        let parsedContent;
        try {
          parsedContent = JSON.parse(contentToSave);
          console.log('✅ Persistence: Content parsed successfully');
        } catch (e) {
          console.error('❌ Persistence: Failed to parse content:', e);
          return;
        }
        
        if (nodeId && !isTemporaryNode) {
          console.log('🔄 Persistence: Updating existing node', nodeId);
          console.log('📦 Persistence: Update payload:', {
            content: parsedContent,
            title,
            contentLength: parsedContent.length,
            firstItem: parsedContent[0]
          });
          
          // Get current node from store to check its type
          const currentNode = nodes.get(nodeId);
          
          // Check if this is a daily note by looking at the nodeId pattern
          const isDailyNote = nodeId.startsWith('daily-');
          
          // For daily notes and pages, sync blocks instead of storing content
          if (isDailyNote || currentNode?.type === 'daily' || currentNode?.type === 'page') {
            console.log('📋 Persistence: Syncing blocks for', currentNode?.type || 'daily note', nodeId);
            await NodeService.syncPageBlocks(workspaceId, nodeId, parsedContent, userId);
            
            // Update page metadata (title, etc) if needed
            if (title !== undefined && currentNode && title !== currentNode.title) {
              await updateNode(workspaceId, nodeId, { title });
            }
          } else {
            // For other node types, update content directly
            await updateNode(workspaceId, nodeId, {
              content: parsedContent,
              ...(title !== undefined && { title }),
            });
          }
          
          console.log('✅ Persistence: Node updated successfully in Firebase');
          
          // Don't clear local content here - it causes the editor to be cleared
          // The local content will be naturally replaced when the Firebase data is loaded
        } else {
          console.log('➕ Persistence: Creating new node (isTemporaryNode:', isTemporaryNode, ')');
          // Create new node
          const newNode: Omit<Node, 'id' | 'createdAt' | 'updatedAt'> = {
            type: 'page',
            parentId,
            order: 0,
            content: parsedContent,
            refs: [],
            createdBy: userId,
          };
          
          const newNodeId = await createNode(workspaceId, newNode);
          console.log('✅ Persistence: New node created with ID:', newNodeId);
          
          // Clear local content for the temp node and set for new node
          if (nodeId) clearLocalContent(nodeId);
          setLocalContent(newNodeId, contentToSave);
          
          // Update the URL to include the new node ID
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', `/workspace/${workspaceId}/node/${newNodeId}`);
          }
        }
      } catch (error) {
        console.error('❌ Persistence: Failed to save content to Firebase:', error);
        throw error;
      }
    },
    [workspaceId, nodeId, parentId, userId, nodes, updateNode, createNode, getLocalContent, setLocalContent, clearLocalContent]
  );
  
  // Get current node data
  const currentNode = nodeId ? nodes.get(nodeId) : null;
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    currentNode,
    blocks,
    blocksLoaded,
    saveContentLocally,
    saveContentToFirebase,
    getLocalContent,
    isWorkspaceReady: !!workspaceId,
    isSaving,
    isLoadingBlocks: !blocksLoaded,
  };
}