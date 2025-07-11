'use client';

import { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Settings, 
  ChevronRight,
  ChevronDown,
  Hash,
  Calendar,
  Users,
  Archive,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarItem {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children?: SidebarItem[];
  isExpanded?: boolean;
}

export function Sidebar() {
  const [items, setItems] = useState<SidebarItem[]>([
    {
      id: '1',
      title: 'Quick Links',
      isExpanded: true,
      children: [
        { id: '1-1', title: 'Getting Started', icon: <FileText size={16} /> },
        { id: '1-2', title: 'Todo List', icon: <Hash size={16} /> },
        { id: '1-3', title: 'Calendar', icon: <Calendar size={16} /> },
      ]
    },
    {
      id: '2',
      title: 'Workspace',
      isExpanded: true,
      children: [
        { id: '2-1', title: 'Team Notes', icon: <Users size={16} /> },
        { id: '2-2', title: 'Projects', icon: <FileText size={16} /> },
      ]
    }
  ]);

  const toggleExpand = (itemId: string) => {
    setItems(items.map(item => 
      item.id === itemId 
        ? { ...item, isExpanded: !item.isExpanded }
        : item
    ));
  };

  const renderItem = (item: SidebarItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    
    return (
      <div key={item.id} className="select-none">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded-md transition-colors",
            level > 0 && "ml-5"
          )}
          onClick={() => hasChildren && toggleExpand(item.id)}
        >
          {hasChildren && (
            <span className="text-gray-400">
              {item.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          {!hasChildren && item.icon && (
            <span className="text-gray-500">{item.icon}</span>
          )}
          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{item.title}</span>
        </div>
        {hasChildren && item.isExpanded && (
          <div>
            {item.children!.map(child => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-60 bg-gray-50 dark:bg-gray-900 h-full flex flex-col border-r border-gray-200 dark:border-gray-800">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Notion Clone</h2>
        
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
          <Search size={16} />
          <span>Quick Find</span>
        </button>
        
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors mt-1">
          <Plus size={16} />
          <span>New Page</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-2">
        <div className="pb-4">
          {items.map(item => renderItem(item))}
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
          <div className="px-3 py-1.5 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md cursor-pointer">
            <Archive size={16} />
            <span>Archive</span>
          </div>
          <div className="px-3 py-1.5 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md cursor-pointer">
            <Trash2 size={16} />
            <span>Trash</span>
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md cursor-pointer">
          <Settings size={16} />
          <span>Settings & Members</span>
        </div>
      </div>
    </div>
  );
}