'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export function FirestoreSetupGuide() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg shadow-lg p-4 z-50">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
          ⚠️ Firestore Setup Required
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-yellow-700 dark:text-yellow-300 hover:text-yellow-900"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
        To fix the permissions error, follow these steps:
      </p>
      
      <ol className="text-sm space-y-2 text-yellow-800 dark:text-yellow-200">
        <li>
          <strong>1.</strong> Go to{' '}
          <a
            href="https://console.firebase.google.com/project/athena-558f8/firestore"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-yellow-900 dark:text-yellow-100 font-medium"
          >
            Firebase Console
          </a>
        </li>
        <li>
          <strong>2.</strong> Click "Create database" if not already created
        </li>
        <li>
          <strong>3.</strong> Choose <strong>"Start in test mode"</strong>
        </li>
        <li>
          <strong>4.</strong> Select a location (e.g., us-central1)
        </li>
        <li>
          <strong>5.</strong> Click "Enable"
        </li>
      </ol>
      
      <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs">
        <strong>Note:</strong> The app will work offline until Firestore is configured.
        Your notes won't be saved to the cloud yet.
      </div>
    </div>
  );
}