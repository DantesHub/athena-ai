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
  buildContentFromDocument,
  buildDocumentFromContent,
} from '@/lib/editor/config';

interface TextEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
  placeholder?: string;
}

export function TextEditor({ 
  initialContent = '[]', 
  onSave,
  placeholder = "Type '/' for commands..."
}: TextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const [title, setTitle] = useState('Untitled');

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const state = EditorState.create({
        doc: buildDocumentFromContent(initialContent),
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
        ],
      });

      editorRef.current = new EditorView(containerRef.current, {
        state,
        dispatchTransaction: (transaction) => {
          handleTransaction({
            transaction,
            editorRef,
            onSaveContent: (content: string) => {
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
  }, []);

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