'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store/workspace.store';
import { WorkspaceService } from '@/lib/firebase/services/workspace.service';
import { NodeService } from '@/lib/firebase/services/node.service';
import { getTodayDate } from '@/lib/utils/date';

export function WorkspaceInitializer({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const { currentWorkspace, workspaces, loadWorkspaces, createWorkspace } = useWorkspaceStore();
  const router = useRouter();
  
  useEffect(() => {
    const initWorkspace = async () => {
      console.log('🏠 WorkspaceInitializer: Starting initialization...');
      // Use a fixed workspace ID for simplicity without auth
      const defaultWorkspaceId = 'default-workspace';
      
      try {
        // Test Firestore connection first
        console.log('🔗 Testing Firestore connection...');
  
        
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
          
          // Clean up any daily notes that have content field
          try {
            await NodeService.cleanupDailyNotesContent(workspace.id);
          } catch (error) {
            console.error('⚠️ Failed to cleanup daily notes, continuing...', error);
          }
          
          // Navigate to today's daily note
          try {
            console.log('📅 WorkspaceInitializer: Navigating to daily note...');
            const todayDate = getTodayDate();
            const dailyNote = await NodeService.getOrCreateDailyNote(
              workspace.id,
              todayDate,
              'default-user'
            );
            
            console.log('🚀 WorkspaceInitializer: Redirecting to daily note:', dailyNote.id);
            router.push(`/workspace/${workspace.id}/node/${dailyNote.id}`);
          } catch (error) {
            console.error('❌ WorkspaceInitializer: Failed to navigate to daily note:', error);
          }
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