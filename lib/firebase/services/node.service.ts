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
  deleteDoc,
  deleteField
} from 'firebase/firestore';
import { db } from '../config';
import type { Node, Edge } from '@/lib/types/firestore';
import { getDailyNoteId, formatDateForDisplay } from '@/lib/utils/date';
import { generateBlockId } from '@/lib/utils/block-id';

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
  
  static async getDailyNote(workspaceId: string, date: string): Promise<Node | null> {
    console.log('📅 Getting daily note for date:', date);
    
    const nodesQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      where('type', '==', 'daily'),
      where('date', '==', date),
      limit(1)
    );
    
    try {
      const nodesSnap = await getDocs(nodesQuery);
      
      if (nodesSnap.empty) {
        console.log('⚠️ Daily note not found for date:', date);
        return null;
      }
      
      const doc = nodesSnap.docs[0];
      const node = { id: doc.id, ...doc.data() } as Node;
      console.log('✅ Daily note found:', node.id);
      return node;
    } catch (error: any) {
      console.error('❌ Failed to get daily note:', {
        error,
        code: error?.code,
        message: error?.message
      });
      throw error;
    }
  }
  
  static async createDailyNote(
    workspaceId: string,
    date: string,
    userId: string
  ): Promise<string> {
    console.log('📅 Creating daily note for date:', date);
    
    // Check if daily note already exists
    const existing = await this.getDailyNote(workspaceId, date);
    if (existing) {
      console.log('ℹ️ Daily note already exists:', existing.id);
      return existing.id;
    }
    
    // Create daily note with a specific ID format
    const nodeId = getDailyNoteId(date);
    const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', nodeId);
    
    const dailyNote: Omit<Node, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'daily',
      date,
      title: formatDateForDisplay(date),
      parentId: null,
      order: 0,
      refs: [],
      createdBy: userId,
      _v: 1
    };
    
    try {
      console.log('🚀 Writing daily note to Firestore...');
      await setDoc(nodeRef, {
        ...dailyNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('✅ Daily note created successfully with ID:', nodeId);
      return nodeId;
    } catch (error: any) {
      console.error('❌ Failed to create daily note:', {
        error,
        code: error?.code,
        message: error?.message
      });
      throw error;
    }
  }
  
  static async getOrCreateDailyNote(
    workspaceId: string,
    date: string,
    userId: string
  ): Promise<Node> {
    console.log('📅 Getting or creating daily note for date:', date);
    
    // Try to get existing daily note
    const existing = await this.getDailyNote(workspaceId, date);
    if (existing) {
      return existing;
    }
    
    // Create new daily note
    const nodeId = await this.createDailyNote(workspaceId, date, userId);
    const newNode = await this.getNode(workspaceId, nodeId);
    
    if (!newNode) {
      throw new Error('Failed to create daily note');
    }
    
    return newNode;
  }
  
  static async createBlock(
    workspaceId: string,
    parentId: string,
    text: string,
    order: number,
    userId: string
  ): Promise<string> {
    console.log('📦 Creating new block in parent:', parentId);
    
    const blockId = generateBlockId();
    const blockRef = doc(db, 'workspaces', workspaceId, 'nodes', blockId);
    
    const block: Omit<Node, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'paragraph',
      text,
      parentId,
      order,
      refs: [],
      createdBy: userId,
      _v: 1
    };
    
    try {
      await setDoc(blockRef, {
        ...block,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('✅ Block created successfully with ID:', blockId);
      return blockId;
    } catch (error: any) {
      console.error('❌ Failed to create block:', error);
      throw error;
    }
  }
  
  static async updateBlock(
    workspaceId: string,
    blockId: string,
    text: string
  ): Promise<void> {
    console.log('🔄 Updating block:', blockId);
    
    const blockRef = doc(db, 'workspaces', workspaceId, 'nodes', blockId);
    
    try {
      await updateDoc(blockRef, {
        text,
        updatedAt: serverTimestamp(),
      });
      console.log('✅ Block updated successfully');
    } catch (error: any) {
      console.error('❌ Failed to update block:', error);
      throw error;
    }
  }
  
  static async getBlocks(
    workspaceId: string,
    parentId: string
  ): Promise<Node[]> {
    console.log('📋 Getting blocks for parent:', parentId);
    
    const blocksQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      where('parentId', '==', parentId),
      orderBy('order', 'asc')
    );
    
    try {
      const blocksSnap = await getDocs(blocksQuery);
      const blocks = blocksSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Node));
      
      console.log('✅ Found', blocks.length, 'blocks');
      console.log('📋 Block details:', blocks.map(b => ({
        id: b.id,
        type: b.type,
        text: b.text,
        order: b.order,
        parentId: b.parentId
      })));
      return blocks;
    } catch (error: any) {
      console.error('❌ Failed to get blocks:', error);
      throw error;
    }
  }
  
  static async syncPageBlocks(
    workspaceId: string,
    pageId: string,
    content: any[],
    userId: string
  ): Promise<void> {
    console.log('🔄 Syncing blocks for page:', pageId);
    console.log('📋 Content to sync:', JSON.stringify(content, null, 2));
    
    // First, ensure the parent node doesn't have a content field
    // This is important for daily notes that might have been incorrectly saved with content
    const nodeRef = doc(db, 'workspaces', workspaceId, 'nodes', pageId);
    const nodeSnap = await getDoc(nodeRef);
    if (nodeSnap.exists() && nodeSnap.data().content !== undefined) {
      console.log('🧹 Cleaning up content field from parent node:', pageId);
      await updateDoc(nodeRef, {
        content: deleteField(),
        updatedAt: serverTimestamp()
      });
    }
    
    // Get existing blocks
    const existingBlocks = await this.getBlocks(workspaceId, pageId);
    const existingBlockMap = new Map(existingBlocks.map(b => [b.order, b]));
    
    // Process content array
    const batch = writeBatch(db);
    const processedOrders = new Set<number>();
    
    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      processedOrders.add(i);
      
      // Handle different content types
      if (item.type === 'paragraph' && item.content !== undefined) {
        const existingBlock = existingBlockMap.get(i);
        
        if (existingBlock) {
          // Update existing block if text changed
          if (existingBlock.text !== item.content) {
            const blockRef = doc(db, 'workspaces', workspaceId, 'nodes', existingBlock.id);
            batch.update(blockRef, {
              text: item.content,
              updatedAt: serverTimestamp()
            });
            console.log('📝 Updating block:', existingBlock.id);
          }
        } else {
          // Create new block
          const blockId = generateBlockId();
          const blockRef = doc(db, 'workspaces', workspaceId, 'nodes', blockId);
          batch.set(blockRef, {
            type: 'paragraph',
            text: item.content,
            parentId: pageId,
            order: i,
            refs: [],
            createdBy: userId,
            _v: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log('➕ Creating new paragraph block:', blockId);
        }
      } else if (item.type === 'bullet_list' && item.items) {
        console.log('🔫 Processing bullet list with', item.items.length, 'items');
        
        // First, check if there's already a list wrapper at this position
        const existingListWrapper = existingBlockMap.get(i);
        let listId: string;
        
        if (existingListWrapper && existingListWrapper.type === 'list') {
          // Use existing list wrapper
          listId = existingListWrapper.id;
          console.log('📋 Using existing list wrapper:', listId);
        } else {
          // Create list wrapper node
          listId = `lst_${generateBlockId()}`;
          const listRef = doc(db, 'workspaces', workspaceId, 'nodes', listId);
          batch.set(listRef, {
            type: 'list',
            listStyle: 'bullet',
            parentId: pageId,
            order: i,
            refs: [],
            createdBy: userId,
            _v: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log('➕ Creating list wrapper:', listId);
        }
        
        // Get existing list items for this list
        const existingListItems = await this.getBlocks(workspaceId, listId);
        const existingListItemMap = new Map(existingListItems.map(b => [b.order, b]));
        
        // Create/update list items
        for (let j = 0; j < item.items.length; j++) {
          const listItemText = item.items[j];
          const existingItem = existingListItemMap.get(j);
          
          if (existingItem) {
            // Update existing list item if text changed
            if (existingItem.text !== listItemText) {
              const itemRef = doc(db, 'workspaces', workspaceId, 'nodes', existingItem.id);
              batch.update(itemRef, {
                text: listItemText,
                updatedAt: serverTimestamp()
              });
              console.log('📝 Updating list item:', existingItem.id);
            }
          } else {
            // Create new list item
            const itemId = `li_${generateBlockId()}`;
            const itemRef = doc(db, 'workspaces', workspaceId, 'nodes', itemId);
            batch.set(itemRef, {
              type: 'listItem',
              text: listItemText,
              parentId: listId,
              order: j,
              refs: [],
              createdBy: userId,
              _v: 1,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            console.log('➕ Creating list item:', itemId, 'with text:', listItemText);
          }
        }
        
        // Delete list items that no longer exist
        for (const [order, item] of existingListItemMap) {
          if (order >= item.items.length) {
            const itemRef = doc(db, 'workspaces', workspaceId, 'nodes', item.id);
            batch.delete(itemRef);
            console.log('🗑️ Deleting excess list item:', item.id);
          }
        }
      }
    }
    
    // Delete blocks that no longer exist
    for (const [order, block] of existingBlockMap) {
      // Check if this block's order is in processedOrders (including fractional orders)
      let isProcessed = false;
      for (const processedOrder of processedOrders) {
        if (Math.abs(order - processedOrder) < 0.0001) {
          isProcessed = true;
          break;
        }
      }
      
      if (!isProcessed) {
        const blockRef = doc(db, 'workspaces', workspaceId, 'nodes', block.id);
        batch.delete(blockRef);
        console.log('🗑️ Deleting block:', block.id);
      }
    }
    
    try {
      await batch.commit();
      console.log('✅ Block sync complete');
    } catch (error: any) {
      console.error('❌ Failed to sync blocks:', error);
      throw error;
    }
  }
  
  static async cleanupDailyNotesContent(workspaceId: string): Promise<void> {
    console.log('🧹 Cleaning up content field from all daily notes...');
    
    const dailyNotesQuery = query(
      collection(db, 'workspaces', workspaceId, 'nodes'),
      where('type', '==', 'daily')
    );
    
    try {
      const dailyNotesSnap = await getDocs(dailyNotesQuery);
      const batch = writeBatch(db);
      let cleanupCount = 0;
      
      for (const docSnap of dailyNotesSnap.docs) {
        if (docSnap.data().content !== undefined) {
          console.log('🧹 Removing content field from daily note:', docSnap.id);
          batch.update(docSnap.ref, {
            content: deleteField(),
            updatedAt: serverTimestamp()
          });
          cleanupCount++;
        }
      }
      
      if (cleanupCount > 0) {
        await batch.commit();
        console.log('✅ Cleaned up content field from', cleanupCount, 'daily notes');
      } else {
        console.log('✅ No daily notes needed cleanup');
      }
    } catch (error: any) {
      console.error('❌ Failed to cleanup daily notes:', error);
      throw error;
    }
  }
}