'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function TestFirestore() {
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const testFirestore = async () => {
    setStatus('Testing Firestore connection...');
    setError('');

    try {
      // Test 1: Try to write a simple document
      const testDoc = doc(db, 'test', 'test-doc');
      await setDoc(testDoc, {
        message: 'Hello from Athena!',
        timestamp: new Date(),
      });
      setStatus('✅ Write successful!');

      // Test 2: Try to read it back
      const docSnap = await getDoc(testDoc);
      if (docSnap.exists()) {
        setStatus('✅ Write and Read successful! Data: ' + JSON.stringify(docSnap.data()));
      }
    } catch (err: any) {
      setError(`❌ Error: ${err.message}`);
      setStatus('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6">Firestore Connection Test</h1>
        
        <button
          onClick={testFirestore}
          className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors mb-6"
        >
          Test Firestore Connection
        </button>

        {status && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg mb-4">
            {status}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h2 className="font-semibold mb-2">Quick Fix Instructions:</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              Go to{' '}
              <a
                href="https://console.firebase.google.com/project/athena-558f8/firestore"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                Firebase Console → Firestore
              </a>
            </li>
            <li>Click "Create database"</li>
            <li>
              <strong className="text-red-600">IMPORTANT:</strong> Choose "Start in test mode"
            </li>
            <li>Select your region (us-central1 is fine)</li>
            <li>Click "Enable"</li>
            <li>Come back here and click the test button again</li>
          </ol>
        </div>

        <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-sm">
            <strong>Note:</strong> Test mode allows unrestricted access for 30 days, which is perfect for development.
          </p>
        </div>
      </div>
    </div>
  );
}