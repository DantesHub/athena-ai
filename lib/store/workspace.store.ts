import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Workspace, Node } from '@/lib/types/firestore';
import { WorkspaceService } from '@/lib/firebase/services/workspace.service';
import { NodeService } from '@/lib/firebase/services/node.service';

interface WorkspaceState {
  // Current workspace
  currentWorkspace: Workspace | null;
  currentNodeId: string | null;
  
  // Cached data
  workspaces: Workspace[];
  nodes: Map<string, Node>;
  childNodes: Map<string, Node[]>; // parentId -> children
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setCurrentNode: (nodeId: string | null) => void;
  loadWorkspaces: (userId: string) => Promise<void>;
  createWorkspace: (name: string, userId: string) => Promise<string>;
  loadNode: (workspaceId: string, nodeId: string) => Promise<Node | null>;
  loadChildNodes: (workspaceId: string, parentId: string | null) => Promise<Node[]>;
  createNode: (workspaceId: string, node: Omit<Node, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateNode: (workspaceId: string, nodeId: string, updates: Partial<Node>) => Promise<void>;
  deleteNode: (workspaceId: string, nodeId: string) => Promise<void>;
  clearCache: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    (set, get) => ({
        // Initial state
        currentWorkspace: null,
        currentNodeId: null,
        workspaces: [],
        nodes: new Map(),
        childNodes: new Map(),
        isLoading: false,
        error: null,
        
        // Actions
        setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
        
        setCurrentNode: (nodeId) => set({ currentNodeId: nodeId }),
        
        loadWorkspaces: async (userId) => {
          set({ isLoading: true, error: null });
          try {
            const workspaces = await WorkspaceService.getUserWorkspaces(userId);
            set({ workspaces, isLoading: false });
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
          }
        },
        
        createWorkspace: async (name, userId) => {
          set({ isLoading: true, error: null });
          try {
            const workspaceId = await WorkspaceService.createWorkspace(name, userId);
            const workspace = await WorkspaceService.getWorkspace(workspaceId);
            if (workspace) {
              set(state => ({
                workspaces: [...state.workspaces, workspace],
                currentWorkspace: workspace,
                isLoading: false
              }));
            }
            return workspaceId;
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
            throw error;
          }
        },
        
        loadNode: async (workspaceId, nodeId) => {
          console.log('🏪 Store: Loading node', nodeId, 'from workspace', workspaceId);
          const { nodes } = get();
          
          // Check cache first
          if (nodes.has(nodeId)) {
            console.log('📦 Store: Found node in cache');
            return nodes.get(nodeId)!;
          }
          
          console.log('🌐 Store: Fetching node from Firestore...');
          set({ isLoading: true, error: null });
          try {
            const node = await NodeService.getNode(workspaceId, nodeId);
            if (node) {
              console.log('✅ Store: Node loaded successfully');
              set(state => {
                const newNodes = new Map(state.nodes);
                newNodes.set(nodeId, node);
                return { nodes: newNodes, isLoading: false };
              });
            } else {
              console.log('⚠️ Store: Node not found');
            }
            return node;
          } catch (error) {
            console.error('❌ Store: Failed to load node:', error);
            set({ error: (error as Error).message, isLoading: false });
            return null;
          }
        },
        
        loadChildNodes: async (workspaceId, parentId) => {
          const cacheKey = parentId || 'root';
          const { childNodes } = get();
          
          // Check cache first
          if (childNodes.has(cacheKey)) {
            return childNodes.get(cacheKey)!;
          }
          
          set({ isLoading: true, error: null });
          try {
            const children = await NodeService.getChildNodes(workspaceId, parentId);
            set(state => {
              const newChildNodes = new Map(state.childNodes);
              newChildNodes.set(cacheKey, children);
              
              // Also update nodes cache
              const newNodes = new Map(state.nodes);
              children.forEach(node => newNodes.set(node.id, node));
              
              return { childNodes: newChildNodes, nodes: newNodes, isLoading: false };
            });
            return children;
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
            return [];
          }
        },
        
        createNode: async (workspaceId, node) => {
          console.log('🏪 Store: Creating new node in workspace', workspaceId);
          set({ isLoading: true, error: null });
          try {
            const nodeId = await NodeService.createNode(workspaceId, node);
            console.log('✅ Store: Node created with ID:', nodeId);
            
            const newNode = await NodeService.getNode(workspaceId, nodeId);
            
            if (newNode) {
              set(state => {
                const newNodes = new Map(state.nodes);
                newNodes.set(nodeId, newNode);
                
                // Update child nodes cache if applicable
                const cacheKey = node.parentId || 'root';
                const newChildNodes = new Map(state.childNodes);
                const siblings = newChildNodes.get(cacheKey) || [];
                newChildNodes.set(cacheKey, [...siblings, newNode]);
                
                return { nodes: newNodes, childNodes: newChildNodes, isLoading: false };
              });
            }
            
            return nodeId;
          } catch (error) {
            console.error('❌ Store: Failed to create node:', error);
            set({ error: (error as Error).message, isLoading: false });
            throw error;
          }
        },
        
        updateNode: async (workspaceId, nodeId, updates) => {
          console.log('🏪 Store: Updating node', nodeId, 'in workspace', workspaceId);
          console.log('📄 Store: Update data:', {
            hasContent: 'content' in updates,
            hasTitle: 'title' in updates,
            updateFields: Object.keys(updates)
          });
          
          set({ isLoading: true, error: null });
          try {
            await NodeService.updateNode(workspaceId, nodeId, updates);
            console.log('✅ Store: Node updated successfully');
            
            // Update cache
            const { nodes } = get();
            const existingNode = nodes.get(nodeId);
            if (existingNode) {
              const updatedNode = { ...existingNode, ...updates };
              set(state => {
                const newNodes = new Map(state.nodes);
                newNodes.set(nodeId, updatedNode);
                return { nodes: newNodes, isLoading: false };
              });
            }
          } catch (error) {
            console.error('❌ Store: Failed to update node:', error);
            set({ error: (error as Error).message, isLoading: false });
            throw error;
          }
        },
        
        deleteNode: async (workspaceId, nodeId) => {
          set({ isLoading: true, error: null });
          try {
            const { nodes } = get();
            const node = nodes.get(nodeId);
            
            await NodeService.deleteNode(workspaceId, nodeId);
            
            set(state => {
              const newNodes = new Map(state.nodes);
              newNodes.delete(nodeId);
              
              // Update child nodes cache
              if (node) {
                const cacheKey = node.parentId || 'root';
                const newChildNodes = new Map(state.childNodes);
                const siblings = newChildNodes.get(cacheKey) || [];
                newChildNodes.set(cacheKey, siblings.filter(n => n.id !== nodeId));
                
                return { nodes: newNodes, childNodes: newChildNodes, isLoading: false };
              }
              
              return { nodes: newNodes, isLoading: false };
            });
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
            throw error;
          }
        },
        
        clearCache: () => set({
          nodes: new Map(),
          childNodes: new Map(),
        }),
      })
  )
);