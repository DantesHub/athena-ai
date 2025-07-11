'use client';

import { Sidebar } from '@/components/sidebar';
import { TiptapEditor } from '@/components/tiptap-editor';
import { DocumentModel } from '@/lib/document/types';

export default function Home() {
  const handleSave = (document: DocumentModel) => {
    // In a real app, this would save to a database
    console.log('Document saved:', document.getDocument());
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      <Sidebar />
      <TiptapEditor onSave={handleSave} />
    </div>
  );
}