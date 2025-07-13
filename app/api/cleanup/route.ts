import { NextResponse } from 'next/server';
import { NodeService } from '@/lib/firebase/services/node.service';

export async function POST(request: Request) {
  try {
    const { workspaceId } = await request.json();
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }
    
    // Run the cleanup
    await NodeService.cleanupDailyNotesContent(workspaceId);
    
    return NextResponse.json({ success: true, message: 'Cleanup completed' });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}