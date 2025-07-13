'use client';

import { TextEditor } from '@/components/text-editor';
import { WorkspaceInitializer } from '@/components/workspace-initializer';
import { Sidebar } from '@/components/sidebar';
import { ChatInterface } from '@/components/chat-interface';
import { FirestoreSetupGuide } from '@/components/firestore-setup-guide';
import { DebugConsole } from '@/components/debug-console';
import { useState } from 'react';

import { use } from 'react';

interface PageProps {
  params: Promise<{
    workspaceId: string;
    nodeId: string;
  }>;
}

export default function NodePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [chatState, setChatState] = useState<{
    isOpen: boolean;
    initialMessage?: string;
  }>({ isOpen: false });

  const openChat = (message: string) => {
    setChatState({ isOpen: true, initialMessage: message });
  };

  const closeChat = () => {
    setChatState({ isOpen: false, initialMessage: undefined });
  };

  return (
    <WorkspaceInitializer>
      <div className="flex h-screen bg-white dark:bg-gray-950 relative overflow-hidden">
        <Sidebar />
        
        {/* Main content area with transition */}
        <div
          className={`flex-1 transition-all duration-300 ease-in-out ${
            chatState.isOpen ? 'mr-[600px]' : 'mr-0'
          }`}
        >
          <TextEditor 
            workspaceId={resolvedParams.workspaceId}
            nodeId={resolvedParams.nodeId}
            onOpenChat={openChat} 
          />
        </div>

        {/* Chat interface sliding panel */}
        <div
          className={`fixed right-0 top-0 h-full w-[600px] bg-background border-l transform transition-transform duration-300 ease-in-out ${
            chatState.isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {chatState.isOpen && (
            <ChatInterface
              initialMessage={chatState.initialMessage}
              onClose={closeChat}
            />
          )}
        </div>
      </div>
      
      {/* Firestore Setup Guide */}
      <FirestoreSetupGuide />
      
      {/* Debug Console */}
      <DebugConsole />
    </WorkspaceInitializer>
  );
}