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
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
import { debounce } from '@/lib/utils';

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
  
  // Track initialization state
  const isInitializedRef = useRef(false);
  const prevNodeIdRef = useRef(nodeId);
  const prevBlocksLengthRef = useRef(0);
  
  const { currentNode, blocks, blocksLoaded, saveContentLocally, saveContentToFirebase, isWorkspaceReady, isSaving, getLocalContent, isLoadingBlocks } = useEditorPersistence({
    workspaceId,
    nodeId,
  });
  
  // Create a debounced version of saveContentToFirebase to prevent saving partial content
  const debouncedSaveToFirebase = useMemo(
    () => debounce((content: string, title: string) => {
      console.log('💾 Debounced save triggered');
      saveContentToFirebase(content, title);
    }, 1000), // Wait 1 second after typing stops
    [saveContentToFirebase]
  );
  
  // Log component state after render
  useEffect(() => {
    console.log('🔍 TextEditor: Component state - blocks:', blocks?.length, 'currentNode:', currentNode?.type);
  }, [blocks, currentNode]);
  
  // Update title when currentNode changes
  useEffect(() => {
    if (currentNode?.title) {
      setTitle(currentNode.title);
    }
  }, [currentNode]);
  
  // Clear block cache when switching pages
  useEffect(() => {
    if (nodeId && prevNodeIdRef.current && nodeId !== prevNodeIdRef.current) {
      // Dynamic import to avoid circular dependency
      import('@/lib/store/block-cache.store').then(({ useBlockCacheStore }) => {
        const blockCacheStore = useBlockCacheStore.getState();
        blockCacheStore.clearPageCache(prevNodeIdRef.current!);
        console.log('🗑️ Cleared block cache for previous page');
      });
    }
  }, [nodeId]);
  
  
  // Initialize editor only when needed
  useEffect(() => {
    console.log('🏗️ TextEditor: useEffect running, nodeId:', nodeId, 'blocks:', blocks?.length);
    
    // Destroy and recreate editor only if nodeId changes
    if (nodeId !== prevNodeIdRef.current) {
      console.log('🔄 TextEditor: Node changed, recreating editor');
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
      isInitializedRef.current = false;
      prevNodeIdRef.current = nodeId;
    }
    
    // For daily notes/pages: Reset initialization if blocks state changes
    if (currentNode && (currentNode.type === 'daily' || currentNode.type === 'page')) {
      const currentBlocksLength = blocks?.length || 0;
      console.log('🔍 TextEditor: Blocks check - prev:', prevBlocksLengthRef.current, 'current:', currentBlocksLength, 'initialized:', isInitializedRef.current);
      
      if (blocks !== undefined && currentBlocksLength !== prevBlocksLengthRef.current) {
        console.log('🔄 TextEditor: Blocks changed, need to reinitialize');
        if (editorRef.current) {
          console.log('🗑️ TextEditor: Destroying old editor');
          editorRef.current.destroy();
          editorRef.current = null;
        }
        isInitializedRef.current = false;
        prevBlocksLengthRef.current = currentBlocksLength;
      }
    }
    
    // Skip if already initialized for this nodeId
    if (isInitializedRef.current) {
      console.log('🎯 TextEditor: Already initialized, skipping');
      return;
    }
    
    // For daily notes and pages, wait for blocks to load
    if (currentNode && (currentNode.type === 'daily' || currentNode.type === 'page')) {
      console.log('🔍 TextEditor: Daily/Page node detected. Blocks loaded:', blocksLoaded, 'blocks:', blocks?.length);
      // Wait for blocks to be loaded from Firebase
      if (!blocksLoaded) {
        console.log('⏳ TextEditor: Blocks not loaded yet, waiting...');
        // Don't initialize yet
        return;
      }
      console.log('✅ TextEditor: Blocks are loaded:', blocks?.length || 0, 'blocks');
      if (blocks && blocks.length > 0) {
        console.log('📋 TextEditor: Block details:', blocks.map(b => ({ id: b.id, text: b.text, order: b.order })));
      }
    }
    
    if (containerRef.current && !editorRef.current && !isInitializedRef.current) {
      console.log('🚀 TextEditor: Creating new editor instance');
      console.log('🚀 TextEditor: isInitialized:', isInitializedRef.current, 'editorRef:', !!editorRef.current);
      
      // Determine initial content
      const localContent = nodeId ? getLocalContent(nodeId) : undefined;
      let content: string;
      
      if (localContent) {
        content = localContent;
        console.log('📱 TextEditor: Using local content');
      } else if (blocks && blocks.length > 0) {
        // Convert blocks to content format
        console.log('📋 TextEditor: Converting blocks to content, blocks:', blocks);
        console.log('📋 TextEditor: Raw block data:', JSON.stringify(blocks, null, 2));
        
        // Sort blocks by order
        const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
        console.log('📋 TextEditor: Sorted blocks:', sortedBlocks.map(b => ({ 
          type: b.type, 
          text: b.text?.substring(0, 50), 
          order: b.order 
        })));
        
        // Convert blocks to editor content
        const blockContent: any[] = [];
        
        for (let i = 0; i < sortedBlocks.length; i++) {
          const block = sortedBlocks[i];
          
          console.log(`📝 TextEditor: Processing block ${i}:`, { 
            type: block.type, 
            text: block.text?.substring(0, 30), 
            hasText: !!block.text,
            order: block.order
          });
          
          if (block.type === 'bullet') {
            // Bullet lists are now stored as single blocks with newline-separated items
            const items = block.text?.split('\n').filter(item => item.trim()) || [];
            blockContent.push({
              type: 'bullet_list',
              items: items
            });
          } else if (block.type === 'paragraph' || block.type === 'text') {
            // Handle paragraph blocks - include empty ones to preserve spacing
            blockContent.push({
              type: 'paragraph',
              content: block.text || ''
            });
          } else if (block.type === 'heading') {
            blockContent.push({
              type: 'heading',
              level: 2, // Default level, could be enhanced later
              content: block.text || ''
            });
          }
        }
        
        console.log('📋 TextEditor: Block content after mapping:', blockContent);
        
        // Don't add heading for daily notes - it's already shown in the UI
        
        // If no content was generated, add an empty paragraph
        if (blockContent.length === 0) {
          blockContent.push({
            type: 'paragraph',
            content: ''
          });
        }
        
        content = JSON.stringify(blockContent);
        console.log('📋 TextEditor: Using blocks content:', blocks.length, 'blocks');
      } else if (currentNode?.content && currentNode.type !== 'daily' && currentNode.type !== 'page') {
        content = JSON.stringify(currentNode.content);
        console.log('☁️ TextEditor: Using Firestore content');
      } else if (currentNode?.type === 'daily' && currentNode.title) {
        // For new daily notes with no blocks yet - just start with empty paragraph
        content = JSON.stringify([
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
        
      const state = EditorState.create({
        doc: buildDocumentFromContent(content),
        plugins: [
          history(),
          keymap({
            "Mod-z": undo,
            "Mod-y": redo,
            "Mod-Shift-z": redo,
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
      console.log('📄 TextEditor: Initial doc content:', content);
      
      editorRef.current = new EditorView(containerRef.current, {
        state,
        dispatchTransaction: (transaction) => {
          if (!editorRef.current) return;
          
          const newState = editorRef.current.state.apply(transaction);
          editorRef.current.updateState(newState);
          
          if (transaction.docChanged && !transaction.getMeta('no-save')) {
            const content = buildContentFromDocument(newState.doc);
            
            // Save locally on every change
            if (isWorkspaceReady && nodeId) {
              saveContentLocally(content, title);
            }
            
            // Queue save to Firebase on ANY document change (debounced)
            console.log('📝 TextEditor: Document changed, queueing debounced save');
            debouncedSaveToFirebase(content, title);
            
            if (onSave) {
              onSave(content);
            }
          }
        },
        handleKeyDown: (view, event) => {
          // Cmd/Ctrl+A (Select All) - track this for deletion handling
          if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
            console.log('⌨️ TextEditor: Select All detected');
            // Let ProseMirror handle it, but we'll watch for subsequent delete
          }
          
          // We don't need special handling for Enter or Delete anymore
          // because ALL changes are now handled in dispatchTransaction above
          
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
      
      isInitializedRef.current = true;
    }

    return () => {
      // Only cleanup on unmount
      if (nodeId !== prevNodeIdRef.current) {
        if (editorRef.current) {
          editorRef.current.destroy();
          editorRef.current = null;
        }
        isInitializedRef.current = false;
      }
    };
  }, [nodeId, onOpenChat, currentNode, blocks, getLocalContent, initialContent, onSave, isWorkspaceReady, saveContentLocally, saveContentToFirebase, debouncedSaveToFirebase, title, blocks?.length]);

  return (
    <div className="flex-1 h-full overflow-y-auto relative">
      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-10">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">Saving to Firebase...</span>
        </div>
      )}
      
      {/* Loading blocks indicator */}
      {isLoadingBlocks && currentNode && (currentNode.type === 'daily' || currentNode.type === 'page') && (
        <div className="fixed top-4 left-4 bg-gray-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-10">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="text-sm font-medium">Loading blocks...</span>
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
          
          {/* Temporary cleanup button */}
          {currentNode?.type === 'daily' && (
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/cleanup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workspaceId: 'default-workspace' })
                  });
                  const result = await response.json();
                  if (result.success) {
                    window.location.reload();
                  }
                } catch (error) {
                  console.error('Cleanup failed:', error);
                }
              }}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Fix Daily Note Storage
            </button>
          )}
        </div>
      </div>
    </div>
  );
}