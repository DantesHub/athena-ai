'use client';

import { Sidebar } from '@/components/sidebar';
import { TextEditor } from '@/components/text-editor';

export default function Home() {
  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      <Sidebar />
      <TextEditor />
    </div>
  );
}