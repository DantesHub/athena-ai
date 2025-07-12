import { useEffect, useCallback, useRef } from 'react';
import { useWorkspaceStore } from '@/lib/store/workspace.store';
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
  } = useWorkspaceStore();
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Load node if nodeId is provided
  useEffect(() => {
    if (workspaceId && nodeId) {
      loadNode(workspaceId, nodeId);
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
  
  // Save content with debouncing
  const saveContent = useCallback(
    async (contentString: string, title?: string) => {
      if (!workspaceId || !userId) {
        console.log('⚠️ Persistence: Missing workspaceId or userId, skipping save');
        return;
      }
      
      console.log('💾 Persistence: Save requested for', nodeId ? `node ${nodeId}` : 'new node');
      console.log('📄 Persistence: Content length:', contentString.length);
      
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Debounce the save
      saveTimeoutRef.current = setTimeout(async () => {
        console.log('⏱️ Persistence: Debounce timer fired, saving content...');
        try {
          // Parse the content string to get the actual content array
          let parsedContent;
          try {
            parsedContent = JSON.parse(contentString);
            console.log('✅ Persistence: Content parsed successfully');
            console.log('📃 Persistence: Content structure:', {
              isArray: Array.isArray(parsedContent),
              length: parsedContent?.length,
              firstItemType: parsedContent?.[0]?.type
            });
          } catch (e) {
            console.error('❌ Persistence: Failed to parse content:', e);
            return;
          }
          
          if (nodeId) {
            console.log('🔄 Persistence: Updating existing node', nodeId);
            // Update existing node
            await updateNode(workspaceId, nodeId, {
              content: parsedContent,
              ...(title !== undefined && { title }),
            });
            console.log('✅ Persistence: Node updated successfully');
          } else {
            console.log('➕ Persistence: Creating new node');
            // Create new node
            const newNode: Omit<Node, 'id' | 'createdAt' | 'updatedAt'> = {
              type: 'page',
              parentId,
              order: 0, // TODO: Calculate proper order
              content: parsedContent,
              refs: [], // TODO: Extract references from content
              createdBy: userId,
            };
            
            const newNodeId = await createNode(workspaceId, newNode);
            console.log('✅ Persistence: New node created with ID:', newNodeId);
            
            // Update the URL to include the new node ID
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', `/workspace/${workspaceId}/node/${newNodeId}`);
            }
          }
        } catch (error) {
          console.error('❌ Persistence: Failed to save content:', error);
        }
      }, 1000); // 1 second debounce
    },
    [workspaceId, nodeId, parentId, userId, updateNode, createNode]
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
    saveContent,
    isWorkspaceReady: !!workspaceId,
  };
}