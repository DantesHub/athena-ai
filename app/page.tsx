'use client';

import { WorkspaceInitializer } from '@/components/workspace-initializer';
import { FirestoreSetupGuide } from '@/components/firestore-setup-guide';
import { DebugConsole } from '@/components/debug-console';

export default function Home() {
  return (
    <WorkspaceInitializer>
      <div className="flex h-screen bg-white dark:bg-gray-950 relative overflow-hidden items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
          <p className="text-muted-foreground">Navigating to daily note...</p>
        </div>
      </div>
      
      {/* Firestore Setup Guide */}
      <FirestoreSetupGuide />
      
      {/* Debug Console */}
      <DebugConsole />
    </WorkspaceInitializer>
  );
}