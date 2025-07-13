#!/usr/bin/env node

/**
 * Script to clean up daily note documents that have a content field
 * Content should only exist as individual block documents
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc,
  doc,
  deleteField
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupDailyNotes() {
  console.log('🧹 Starting cleanup of daily notes with content fields...');
  
  try {
    // Get all daily notes with content field
    const nodesRef = collection(db, 'workspaces', 'default-workspace', 'nodes');
    const dailyNotesQuery = query(nodesRef, where('type', '==', 'daily'));
    const pagesQuery = query(nodesRef, where('type', '==', 'page'));
    
    // Process daily notes
    const dailyNotesSnapshot = await getDocs(dailyNotesQuery);
    console.log(`Found ${dailyNotesSnapshot.size} daily notes`);
    
    for (const docSnapshot of dailyNotesSnapshot.docs) {
      const data = docSnapshot.data();
      if ('content' in data) {
        console.log(`Removing content field from daily note: ${docSnapshot.id}`);
        await updateDoc(doc(db, 'workspaces', 'default-workspace', 'nodes', docSnapshot.id), {
          content: deleteField()
        });
      }
    }
    
    // Process pages
    const pagesSnapshot = await getDocs(pagesQuery);
    console.log(`Found ${pagesSnapshot.size} pages`);
    
    for (const docSnapshot of pagesSnapshot.docs) {
      const data = docSnapshot.data();
      if ('content' in data) {
        console.log(`Removing content field from page: ${docSnapshot.id}`);
        await updateDoc(doc(db, 'workspaces', 'default-workspace', 'nodes', docSnapshot.id), {
          content: deleteField()
        });
      }
    }
    
    console.log('✅ Cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupDailyNotes().then(() => {
  console.log('Script finished');
  process.exit(0);
});