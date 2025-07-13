import type { Node } from './firestore';

export type Operation = 
  | { kind: 'create'; node: Omit<Node, 'id' | 'createdAt' | 'updatedAt'>; nodeId: string; workspaceId: string }
  | { kind: 'update'; nodeId: string; workspaceId: string; delta: Partial<Node> }
  | { kind: 'delete'; nodeId: string; workspaceId: string }
  | { kind: 'deleteAll'; pageId: string; workspaceId: string };

export interface OperationQueueState {
  operations: Operation[];
  flushTimer: NodeJS.Timeout | null;
  isProcessing: boolean;
  addOperation: (op: Operation) => void;
  addOperations: (ops: Operation[]) => void;
  flushOperations: () => Promise<void>;
  clearQueue: () => void;
}