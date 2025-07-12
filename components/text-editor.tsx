'use client';

import { exampleSetup } from 'prosemirror-example-setup';
import { inputRules } from 'prosemirror-inputrules';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { useEffect, useRef, useState } from 'react';
import {
  documentSchema,
  handleTransaction,
  headingRule,
  bulletListRule,
  orderedListRule,
  buildListKeymap,
  buildAISuggestionPlugin,
  buildContentFromDocument,
  buildDocumentFromContent,
} from '@/lib/editor/config';
import { useEditorPersistence } from '@/hooks/use-editor-persistence';

interface TextEditorProps {
  workspaceId?: string;
  nodeId?: string;
  initialContent?: string;
  onSave?: (content: string) => void;
  placeholder?: string;
  onOpenChat?: (message: string) => void;
}

export function TextEditor({ 
  workspaceId,
  nodeId,
  initialContent = '[]', 
  onSave,
  placeholder = "Type '/' for commands...",
  onOpenChat
}: TextEditorProps) {
  console.log('📝 TextEditor: Rendered with workspaceId:', workspaceId, 'nodeId:', nodeId);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const [title, setTitle] = useState('Untitled');
  
  const { currentNode, saveContent, isWorkspaceReady } = useEditorPersistence({
    workspaceId,
    nodeId,
  });
  
  console.log('📃 TextEditor: Persistence hook state:', {
    isWorkspaceReady,
    hasCurrentNode: !!currentNode,
    currentNodeId: currentNode?.id
  });

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      // Use content from Firestore if available, otherwise use initialContent
      const content = currentNode?.content 
        ? JSON.stringify(currentNode.content)
        : initialContent;
        
      const state = EditorState.create({
        doc: buildDocumentFromContent(content),
        plugins: [
          ...exampleSetup({ schema: documentSchema, menuBar: false }),
          inputRules({
            rules: [
              headingRule(1),
              headingRule(2),
              headingRule(3),
              headingRule(4),
              headingRule(5),
              headingRule(6),
              bulletListRule(),
              orderedListRule(),
            ],
          }),
          buildListKeymap(),
          buildAISuggestionPlugin(onOpenChat),
        ],
      });

      editorRef.current = new EditorView(containerRef.current, {
        state,
        dispatchTransaction: (transaction) => {
          handleTransaction({
            transaction,
            editorRef,
            onSaveContent: (content: string) => {
              // Save to Firestore if workspace is ready
              if (isWorkspaceReady) {
                saveContent(content, title);
              }
              // Also call the prop callback if provided
              if (onSave) {
                onSave(content);
              }
            },
          });
        },
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [onOpenChat, initialContent, onSave]);

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-16 py-8">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-4xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none mb-8 placeholder-gray-400"
          placeholder="Untitled"
        />
        
        <div 
          ref={containerRef}
          className="prose prose-lg dark:prose-invert max-w-none focus:outline-none"
          data-placeholder={placeholder}
        />
      </div>
    </div>
  );
}