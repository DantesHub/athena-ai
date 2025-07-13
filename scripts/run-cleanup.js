// Quick script to run the cleanup
import { NodeService } from '../lib/firebase/services/node.service.js';

async function runCleanup() {
  console.log('Running cleanup for default-workspace...');
  await NodeService.cleanupDailyNotesContent('default-workspace');
  console.log('Cleanup complete!');
}

runCleanup().catch(console.error);