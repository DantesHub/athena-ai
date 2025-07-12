import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  limit,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config';
import type { Node, Edge } from '@/lib/types/firestore';

export class NodeService {
  static async createNode(
    workspaceId: string,
    node: Omit<Node, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    console.log('📦 Creating new node in workspace:', workspaceId);
    console.log('📄 Node data:', {
      type: node.type,
      hasContent: !!node.content,
      contentLength: node.content?.length,
      parentId: node.parentId,
      createdBy: node.createdBy
    });
    
    const nodeRef = doc(collection(db, 'workspaces', workspaceId, 'nodes'));
    const newNode = {
      ...node,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    try {
      console.log('🚀 Writing node to Firestore...');
      await setDoc(nodeRef, newNode);
      console.log('✅ Node created successfully with ID:', nodeRef.id);
    } catch (error: any) {
      console.error('❌ Failed to create node:', {
        error,
        code: error?.code,
        message: error?.message
      });
      throw error;
    }
    
    // Create edges for references
    if (node.refs && node.refs.length > 0) {
      const batch = writeBatch(db);
      
      for (const targetId of node.refs) {
        const edgeRef = doc(collection(db, 'workspaces', workspaceId, 'edges'));
        const edge: Omit<Edge, 'id'> = {
          from: nodeRef.id,
          to: targetId,
          kind: 'mention',
          createdAt: serverTimestamp() as Timestamp,
        };
        batch.set(edgeRef, edge);
      }
      
      await batch.commit();
    }
    
    return nodeRef.id;
  }
  
  static async updateNode(
    workspaceId: string,
    nodeId: string,
    updates: Partial<Node>
  ): Promise<void> {
    console.log('🔄 Updating node:', nodeId, 'in workspace:', workspaceId);
    console.log('📄 Updates:', {
      hasContent: 'content' in updates,
      contentLength: updates.content?.length,
      hasTitle: 'title' in updates,
      fields: Object.keys(updates)
    });
    
    const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', nodeId);
    
    try {
      console.log('🚀 Writing updates to Firestore...');
      await updateDoc(nodeRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      console.log('✅ Node updated successfully');
    } catch (error: any) {
      console.error('❌ Failed to update node:', {
        error,
        code: error?.code,
        message: error?.message,
        nodeId,
        workspaceId
      });
      throw error;
    }
    
    // Update edges if refs changed
    if (updates.refs !== undefined) {
      // Delete old edges
      const oldEdgesQuery = query(
        collection(db, 'workspaces', workspaceId, 'edges'),
        where('from', '==', nodeId),
        where('kind', '==', 'mention')
      );
      const oldEdges = await getDocs(oldEdgesQuery);
      
      const batch = writeBatch(db);
      oldEdges.forEach(doc => batch.delete(doc.ref));
      
      // Create new edges
      for (const targetId of updates.refs || []) {
        const edgeRef = doc(collection(db, 'workspaces', workspaceId, 'edges'));
        const edge: Omit<Edge, 'id'> = {
          from: nodeId,
          to: targetId,
          kind: 'mention',
          createdAt: serverTimestamp() as Timestamp,
        };
        batch.set(edgeRef, edge);
      }
      
      await batch.commit();
    }
  }
  
  static async getNode(workspaceId: string, nodeId: string): Promise<Node | null> {
    console.log('🔍 Fetching node:', nodeId, 'from workspace:', workspaceId);
    
    const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', nodeId);
    
    try {
      const nodeSnap = await getDoc(nodeRef);
      
      if (!nodeSnap.exists()) {
        console.log('⚠️ Node not found');
        return null;
      }
      
      const data = nodeSnap.data();
      console.log('✅ Node fetched successfully:', {
        hasData: !!data,
        hasContent: !!data?.content,
        contentLength: data?.content?.length
      });
      
      return { id: nodeSnap.id, ...data } as Node;
    } catch (error: any) {
      console.error('❌ Failed to fetch node:', {
        error,
        code: error?.code,
        message: error?.message
      });
      throw error;
    }
  }
  
  static async getChildNodes(
    workspaceId: string,
    parentId: string | null
  ): Promise<Node[]> {
    const nodesQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      where('parentId', '==', parentId),
      orderBy('order', 'asc')
    );
    
    const nodesSnap = await getDocs(nodesQuery);
    return nodesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Node));
  }
  
  static async getBacklinks(workspaceId: string, nodeId: string): Promise<Edge[]> {
    const edgesQuery = query(
      collection(db, 'workspaces', workspaceId, 'edges'),
      where('to', '==', nodeId)
    );
    
    const edgesSnap = await getDocs(edgesQuery);
    return edgesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Edge));
  }
  
  static async deleteNode(workspaceId: string, nodeId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // Delete the node
    const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', nodeId);
    batch.delete(nodeRef);
    
    // Delete all edges from this node
    const fromEdgesQuery = query(
      collection(db, 'workspaces', workspaceId, 'edges'),
      where('from', '==', nodeId)
    );
    const fromEdges = await getDocs(fromEdgesQuery);
    fromEdges.forEach(doc => batch.delete(doc.ref));
    
    // Delete all edges to this node
    const toEdgesQuery = query(
      collection(db, 'workspaces', workspaceId, 'edges'),
      where('to', '==', nodeId)
    );
    const toEdges = await getDocs(toEdgesQuery);
    toEdges.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
  }
  
  static async getRecentNodes(
    workspaceId: string,
    limitCount: number = 50
  ): Promise<Node[]> {
    const nodesQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );
    
    const nodesSnap = await getDocs(nodesQuery);
    return nodesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Node));
  }
}