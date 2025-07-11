'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useEffect, useState } from 'react';
import { DocumentModel, DocumentNode } from '@/lib/document/types';

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  initialContent?: string;
  onSave?: (document: DocumentModel) => void;
  placeholder?: string;
}

export function TiptapEditor({ 
  initialContent, 
  onSave,
  placeholder = "Type '/' for commands..."
}: TiptapEditorProps) {
  const [title, setTitle] = useState('Untitled');
  const [documentModel] = useState(() => {
    if (initialContent) {
      return DocumentModel.fromJSON(initialContent);
    }
    return new DocumentModel();
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Typography,
    ],
    content: documentModel.getDocument().content,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as DocumentNode;
      documentModel.updateContent(json);
      
      if (onSave) {
        onSave(documentModel);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[300px]',
      },
    },
  });

  useEffect(() => {
    documentModel.updateTitle(title);
    if (onSave) {
      onSave(documentModel);
    }
  }, [title]);

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
        
        <EditorContent editor={editor} />
        
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-500">
          <div className="flex gap-4">
            <span>Words: {documentModel.getDocument().metadata?.wordCount || 0}</span>
            <span>Characters: {documentModel.getDocument().metadata?.characterCount || 0}</span>
            <span>Reading time: {documentModel.getDocument().metadata?.readingTime || 0} min</span>
          </div>
        </div>
      </div>
    </div>
  );
}