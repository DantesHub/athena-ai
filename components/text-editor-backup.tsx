'use client';

import { baseKeymap, chainCommands, newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { splitListItem } from 'prosemirror-schema-list';
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
  
  // For daily notes or existing nodes, use the provided nodeId directly
  const effectiveNodeId = nodeId;
  
  const { currentNode, blocks, saveContentLocally, saveContentToFirebase, isWorkspaceReady, isSaving, getLocalContent } = useEditorPersistence({
    workspaceId,
    nodeId: effectiveNodeId,
  });
  
  // Update title when currentNode changes
  useEffect(() => {
    if (currentNode?.title) {
      setTitle(currentNode.title);
    }
  }, [currentNode]);
  
  console.log('📃 TextEditor: Persistence hook state:', {
    isWorkspaceReady,
    hasCurrentNode: !!currentNode,
    currentNodeId: currentNode?.id
  });

  // Track previous nodeId to detect changes
  const prevNodeIdRef = useRef(nodeId);
  
  // Initialize editor
  useEffect(() => {
    console.log('🏗️ TextEditor: useEffect running, nodeId:', nodeId);
    
    // Destroy existing editor if nodeId changes
    if (editorRef.current && nodeId !== prevNodeIdRef.current) {
      console.log('🔄 TextEditor: Node changed, recreating editor');
      editorRef.current.destroy();
      editorRef.current = null;
      prevNodeIdRef.current = nodeId;
    }
    
    // Skip initialization if editor already exists and nodeId hasn't changed
    if (editorRef.current && nodeId === prevNodeIdRef.current) {
      console.log('🎯 TextEditor: Editor already exists, skipping initialization');
      return;
    }
    
    if (containerRef.current && !editorRef.current) {
      console.log('🚀 TextEditor: Creating new editor instance');
      // Check for local content first, then blocks, then Firestore content, then initialContent
      const localContent = effectiveNodeId ? getLocalContent(effectiveNodeId) : undefined;
      let content: string;
      
      if (localContent) {
        content = localContent;
        console.log('📱 TextEditor: Using local content');
      } else if (blocks && blocks.length > 0) {
        // Convert blocks to content format
        const blockContent = blocks.map(block => ({
          type: 'paragraph',
          content: block.text || ''
        }));
        
        // Add heading for daily notes
        if (currentNode?.type === 'daily' && currentNode.title) {
          blockContent.unshift({
            type: 'heading',
            level: 1,
            content: currentNode.title
          });
        }
        
        content = JSON.stringify(blockContent);
        console.log('📋 TextEditor: Using blocks content:', blocks.length, 'blocks');
      } else if (currentNode?.content) {
        content = JSON.stringify(currentNode.content);
        console.log('☁️ TextEditor: Using Firestore content');
      } else if (currentNode?.type === 'daily' && currentNode.title) {
        // For new daily notes with no blocks yet
        content = JSON.stringify([
          {
            type: 'heading',
            level: 1,
            content: currentNode.title
          },
          {
            type: 'paragraph',
            content: ''
          }
        ]);
        console.log('📅 TextEditor: Creating initial daily note content');
      } else {
        content = initialContent;
        console.log('🆕 TextEditor: Using initial content');
      }
        
      console.log('🔍 TextEditor: Initializing editor with content:', {
        hasLocalContent: !!localContent,
        hasCurrentNode: !!currentNode,
        contentType: typeof currentNode?.content,
        contentLength: content.length,
        contentPreview: content.substring(0, 100)
      });
        
      const state = EditorState.create({
        doc: buildDocumentFromContent(content),
        plugins: [
          // Basic editor plugins without conflicting Enter handlers
          history(),
          keymap({
            "Mod-z": undo,
            "Mod-y": redo,
            "Mod-Shift-z": redo,
            // Add Enter key handling
            "Enter": chainCommands(
              splitListItem(documentSchema.nodes.list_item),
              newlineInCode,
              createParagraphNear,
              liftEmptyBlock,
              splitBlock
            )
          }),
          keymap(baseKeymap),
          dropCursor(),
          gapCursor(),
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

      console.log('🎨 TextEditor: Creating EditorView with plugins');
      
      editorRef.current = new EditorView(containerRef.current, {
        state,
        dispatchTransaction: (transaction) => {
          handleTransaction({
            transaction,
            editorRef,
            onSaveContent: (content: string) => {
              // Save locally to Zustand on every change
              if (isWorkspaceReady) {
                saveContentLocally(content, title);
              }
              // Also call the prop callback if provided
              if (onSave) {
                onSave(content);
              }
            },
          });
        },
        handleKeyDown: (view, event) => {
          // Enter key - save AFTER the new line is created
          if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
            console.log('⌨️ TextEditor: Enter key pressed - will save after new line');
            
            // Save after the Enter key has been processed
            setTimeout(() => {
              // Check if editor still exists
              if (!editorRef.current) {
                console.log('⚠️ TextEditor: Editor destroyed, skipping save');
                return;
              }
              
              const content = buildContentFromDocument(view.state.doc);
              console.log('💾 TextEditor: Saving after Enter - content:', content);
              
              saveContentToFirebase(content, title).then(() => {
                console.log('✅ TextEditor: Enter key save to Firebase complete');
              }).catch(error => {
                console.error('❌ TextEditor: Enter key save to Firebase failed:', error);
              });
            }, 10);
            
            // Return false to let ProseMirror handle Enter normally
            return false;
          }
          
          // Auto-save on Cmd/Ctrl+S
          if ((event.key === 's' || event.key === 'S') && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            console.log('💾 TextEditor: Save triggered with Cmd/Ctrl+S');
            
            const content = buildContentFromDocument(view.state.doc);
            
            // Save locally first
            saveContentLocally(content, title);
            
            // Then save to Firebase
            saveContentToFirebase(content, title).then(() => {
              console.log('✅ TextEditor: Cmd/Ctrl+S save to Firebase complete');
            }).catch(error => {
              console.error('❌ TextEditor: Cmd/Ctrl+S save to Firebase failed:', error);
            });
            
            return true;
          }
          
          return false;
        },
      });
    }

    return () => {
      // Only destroy on unmount, not on every effect re-run
      if (nodeId !== prevNodeIdRef.current) {
        if (editorRef.current) {
          editorRef.current.destroy();
          editorRef.current = null;
        }
      }
    };
  }, [onOpenChat, initialContent, onSave, saveContentToFirebase, saveContentLocally, isWorkspaceReady, title, currentNode, effectiveNodeId, getLocalContent, nodeId]); // Include nodeId to handle changes

  return (
    <div className="flex-1 h-full overflow-y-auto relative">
      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-10">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">Saving to Firebase...</span>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto px-16 py-8">
        {currentNode?.type === 'daily' ? (
          <h1 className="w-full text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8">
            {title}
          </h1>
        ) : (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-4xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none mb-8 placeholder-gray-400"
            placeholder="Untitled"
          />
        )}
        
        <div 
          ref={containerRef}
          className="prose prose-lg dark:prose-invert max-w-none focus:outline-none"
          data-placeholder={placeholder}
        />
        
        {/* Help text */}
        <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>Press <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">Enter</kbd> to save to Firebase</p>
          <p>Your content is automatically saved locally as you type</p>
        </div>
      </div>
    </div>
  );
}