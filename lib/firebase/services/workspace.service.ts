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
  addDoc
} from 'firebase/firestore';
import { db } from '../config';
import type { Workspace, WorkspaceMember } from '@/lib/types/firestore';

export class WorkspaceService {
  static async createWorkspace(name: string, ownerId: string): Promise<string> {
    const workspaceRef = doc(collection(db, 'workspaces'));
    const workspace: Omit<Workspace, 'id'> = {
      name,
      ownerId,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    
    await setDoc(workspaceRef, workspace);
    
    // Add owner as member
    const memberRef = doc(db, 'workspaces', workspaceRef.id, 'members', ownerId);
    const member: WorkspaceMember = {
      uid: ownerId,
      role: 'owner',
      joinedAt: serverTimestamp() as Timestamp,
    };
    await setDoc(memberRef, member);
    
    return workspaceRef.id;
  }
  
  static async createDefaultWorkspace(workspaceId: string): Promise<void> {
    console.log(`📝 Creating default workspace with ID: ${workspaceId}`);
    console.log('🔍 Firestore instance:', {
      exists: !!db,
      type: db?.type,
      appName: db?.app?.name
    });
    
    const workspaceRef = doc(db, 'workspaces', workspaceId);
    console.log('📄 Document reference created:', {
      path: workspaceRef.path,
      id: workspaceRef.id,
      parent: workspaceRef.parent?.path
    });
    
    const workspace: Omit<Workspace, 'id'> = {
      name: 'My Workspace',
      ownerId: 'default-user',
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    
    try {
      console.log('🚀 Attempting to write to Firestore...');
      await setDoc(workspaceRef, workspace);
      console.log('✅ Default workspace created successfully');
    } catch (error: any) {
      console.error('❌ Failed to create default workspace:', {
        error,
        code: error?.code,
        message: error?.message,
        details: error?.details
      });
      throw error;
    }
  }
  
  static async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    console.log(`🔍 Fetching workspace: ${workspaceId}`);
    console.log('🔍 Firestore instance check:', {
      exists: !!db,
      type: db?.type
    });
    
    const workspaceRef = doc(db, 'workspaces', workspaceId);
    console.log('📄 Document reference:', {
      path: workspaceRef.path,
      firestore: !!workspaceRef.firestore
    });
    
    try {
      console.log('🎯 Attempting to fetch document...');
      const workspaceSnap = await getDoc(workspaceRef);
      
      if (!workspaceSnap.exists()) {
        console.log('⚠️ Workspace not found');
        return null;
      }
      
      console.log('✅ Workspace fetched successfully');
      const data = workspaceSnap.data();
      console.log('📃 Workspace data:', {
        hasData: !!data,
        fields: data ? Object.keys(data) : []
      });
      return { id: workspaceSnap.id, ...data } as Workspace;
    } catch (error: any) {
      console.error('❌ Failed to fetch workspace:', {
        error,
        code: error?.code,
        message: error?.message,
        stack: error?.stack
      });
      throw error;
    }
  }
  
  static async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    const workspaces: Workspace[] = [];
    
    // Get all workspaces where user is a member
    const workspacesQuery = query(collection(db, 'workspaces'));
    const workspacesSnap = await getDocs(workspacesQuery);
    
    for (const workspaceDoc of workspacesSnap.docs) {
      const memberRef = doc(db, 'workspaces', workspaceDoc.id, 'members', userId);
      const memberSnap = await getDoc(memberRef);
      
      if (memberSnap.exists()) {
        workspaces.push({ id: workspaceDoc.id, ...workspaceDoc.data() } as Workspace);
      }
    }
    
    return workspaces;
  }
  
  static async checkUserAccess(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const memberRef = doc(db, 'workspaces', workspaceId, 'members', userId);
    const memberSnap = await getDoc(memberRef);
    
    if (!memberSnap.exists()) {
      return null;
    }
    
    return memberSnap.data() as WorkspaceMember;
  }
}