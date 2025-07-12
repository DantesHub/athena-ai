'use client';

import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/lib/store/workspace.store';
import { WorkspaceService } from '@/lib/firebase/services/workspace.service';

export function WorkspaceInitializer({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const { currentWorkspace, workspaces, loadWorkspaces, createWorkspace } = useWorkspaceStore();
  
  useEffect(() => {
    const initWorkspace = async () => {
      console.log('🏠 WorkspaceInitializer: Starting initialization...');
      // Use a fixed workspace ID for simplicity without auth
      const defaultWorkspaceId = 'default-workspace';
      
      try {
        // Check if default workspace exists
        console.log('🔍 WorkspaceInitializer: Checking for existing workspace...');
        let workspace = await WorkspaceService.getWorkspace(defaultWorkspaceId);
        
        // If not, create it
        if (!workspace) {
          console.log('🆕 WorkspaceInitializer: Workspace not found, creating new one...');
          // Create workspace with fixed ID
          await WorkspaceService.createDefaultWorkspace(defaultWorkspaceId);
          workspace = await WorkspaceService.getWorkspace(defaultWorkspaceId);
        } else {
          console.log('✅ WorkspaceInitializer: Found existing workspace');
        }
        
        // Set as current workspace
        if (workspace) {
          console.log('📦 WorkspaceInitializer: Setting current workspace:', workspace.id);
          useWorkspaceStore.setState({ 
            currentWorkspace: workspace,
            workspaces: [workspace]
          });
        }
        
        setIsInitialized(true);
        console.log('✅ WorkspaceInitializer: Initialization complete');
      } catch (error: any) {
        console.error('❌ WorkspaceInitializer: Failed to initialize workspace:', {
          error,
          code: error?.code,
          message: error?.message
        });
        // For now, create a mock workspace to allow the app to work
        console.log('🤖 WorkspaceInitializer: Creating mock workspace...');
        const mockWorkspace = {
          id: defaultWorkspaceId,
          name: 'My Workspace',
          ownerId: 'default-user',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        useWorkspaceStore.setState({ 
          currentWorkspace: mockWorkspace as any,
          workspaces: [mockWorkspace as any]
        });
        setIsInitialized(true);
        console.log('🤖 WorkspaceInitializer: Mock workspace created');
      }
    };
    
    initWorkspace();
  }, []);
  
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing workspace...</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}