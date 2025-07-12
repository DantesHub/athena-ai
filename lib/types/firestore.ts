import { Timestamp } from 'firebase/firestore';

// Workspace types
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkspaceMember {
  uid: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Timestamp;
}

// Node types
export type NodeType = 'text' | 'heading' | 'tag' | 'page' | 'image' | 'bullet_list' | 'ordered_list' | 'list_item';

export interface Node {
  id: string;
  type: NodeType;
  parentId: string | null;
  order: number;
  content: any; // ProseMirror/Tiptap JSON content
  refs: string[]; // outgoing links (denormalized)
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Edge types
export type EdgeKind = 'mention' | 'tag' | 'embed' | 'parent-child';

export interface Edge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  createdAt: Timestamp;
}

// View types
export interface View {
  id: string;
  name: string;
  type: 'search' | 'table' | 'calendar' | 'board';
  query?: any;
  config?: any;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Thread/Comment types
export interface Thread {
  id: string;
  nodeId: string;
  resolved: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  content: string;
  createdBy: string;
  createdAt: Timestamp;
}