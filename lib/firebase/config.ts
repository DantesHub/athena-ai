import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCni_mRx_MgB9ErOqy_Aj6TLm5zmlWQVQU",
  authDomain: "athena-558f8.firebaseapp.com",
  projectId: "athena-558f8",
  storageBucket: "athena-558f8.firebasestorage.app",
  messagingSenderId: "151025407714",
  appId: "1:151025407714:web:62c72ec4c331fdb38f70bb",
  measurementId: "G-HWDXP3FF05"
};

// Initialize Firebase
console.log('🔥 Initializing Firebase with config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  apiKey: firebaseConfig.apiKey.substring(0, 10) + '...'
});

let app: FirebaseApp;
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');
  console.log('📱 App name:', app.name);
  console.log('🔧 App options:', app.options.projectId);

  // Initialize Firebase services
  console.log('🗄️ Initializing Firestore...');
  db = getFirestore(app);
  console.log('✅ Firestore initialized successfully');
  console.log('🔗 Firestore settings:', {
    app: db.app.name,
    type: db.type,
    _databaseId: (db as any)._databaseId?.projectId
  });
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  throw error;
}

export { db };

// Initialize Analytics only in browser environment
if (typeof window !== 'undefined') {
  console.log('📊 Checking Analytics support...');
  isSupported().then(supported => {
    if (supported) {
      const analytics = getAnalytics(app);
      console.log('✅ Analytics initialized');
    } else {
      console.log('⚠️ Analytics not supported in this environment');
    }
  });
}

export default app;