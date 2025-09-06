import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { configService, AppConfig } from './configService';

// Global Firebase instances
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

// Flag to prevent multiple initializations
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

// Check if we're running in a browser environment
const isBrowser = typeof window !== 'undefined';

// Initialize Firebase with config from backend
async function initializeFirebase(): Promise<void> {
  try {
    // If already initialized, return the existing promise
    if (app && auth && db && storage) {
      console.log('🔄 Firebase already initialized, skipping');
      return;
    }
    
    if (isInitializing) {
      console.log('🔄 Firebase initialization in progress, waiting...');
      return initializationPromise!;
    }
    
    isInitializing = true;
    console.log('🔥 Initializing Firebase...');
    
    // Get config from backend
    const config: AppConfig = await configService.getConfig();
    
    // Initialize Firebase app ONLY if not already initialized
    if (!app) {
      app = initializeApp(config.firebase);
    }
    
    // Initialize services ONLY if not already initialized
    if (!auth) {
      auth = getAuth(app);
      
      // Enable auth persistence IMMEDIATELY
      try {
        await setPersistence(auth, browserLocalPersistence);
        console.log('✅ Auth persistence enabled');
      } catch (error) {
        console.warn('⚠️ Auth persistence failed:', error);
      }
    }
    
    if (!db) {
      db = getFirestore(app);
      
      // Enable offline persistence with better error handling
      try {
        await enableIndexedDbPersistence(db, {
          forceOwnership: false // Allow multiple tabs
        });
        console.log('✅ Firestore persistence enabled');
      } catch (err: any) {
        if (err.code === 'failed-precondition') {
          console.warn('⚠️ Multiple tabs open, using memory persistence');
        } else if (err.code === 'unimplemented') {
          console.warn('⚠️ Browser does not support persistence');
        }
        // Continue without persistence rather than failing
      }
    }
    
    if (!storage) {
      storage = getStorage(app);
    }
    
    console.log('✅ Firebase initialized successfully');
    isInitializing = false;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    isInitializing = false;
    throw error;
  }
}

// Get Firebase Auth instance (initializes if needed)
export async function getAuthInstance(): Promise<Auth> {
  if (!auth) {
    if (!initializationPromise) {
      initializationPromise = initializeFirebase();
    }
    await initializationPromise;
  }
  if (!auth) {
    throw new Error('Failed to initialize Firebase Auth');
  }
  return auth;
}

// Get Firestore instance (initializes if needed)  
export async function getFirestoreInstance(): Promise<Firestore> {
  if (!db) {
    if (!initializationPromise) {
      initializationPromise = initializeFirebase();
    }
    await initializationPromise;
  }
  if (!db) {
    throw new Error('Failed to initialize Firestore');
  }
  return db;
}

// Get Storage instance (initializes if needed)
export async function getStorageInstance(): Promise<FirebaseStorage> {
  if (!storage) {
    if (!initializationPromise) {
      initializationPromise = initializeFirebase();
    }
    await initializationPromise;
  }
  if (!storage) {
    throw new Error('Failed to initialize Firebase Storage');
  }
  return storage;
}

// Get Firebase app instance (initializes if needed)
export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (!app) {
    if (!initializationPromise) {
      initializationPromise = initializeFirebase();
    }
    await initializationPromise;
  }
  if (!app) {
    throw new Error('Failed to initialize Firebase App');
  }
  return app;
}

// Phone Auth setup (updated to use async auth instance)
export const setupRecaptcha = async (elementId: string) => {
  const authInstance = await getAuthInstance();
  
  // Clear any existing reCAPTCHA to prevent auth state conflicts
  if ((window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch (e) {
      console.log('Could not clear existing reCAPTCHA');
    }
  }
  
  (window as any).recaptchaVerifier = new RecaptchaVerifier(authInstance, elementId, {
    size: 'invisible',
    callback: () => {
      console.log('Recaptcha verified - preserving auth state');
    },
    'expired-callback': () => {
      console.log('Recaptcha expired - auth state preserved');
    }
  });
  
  return (window as any).recaptchaVerifier;
};

export const sendOTP = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => {
  try {
    const authInstance = await getAuthInstance();
    const confirmation = await signInWithPhoneNumber(authInstance, phoneNumber, recaptchaVerifier);
    return confirmation;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
};

// Ensure Firebase is initialized when this module loads (but only once)
if (isBrowser && !initializationPromise) {
  initializationPromise = initializeFirebase().catch(console.error);
}

// Export instances (will be null until initialized - use getters instead)
export { auth, db, storage };

export default app;