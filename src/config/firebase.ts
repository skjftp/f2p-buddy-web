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

// Initialize Firebase with config from backend
async function initializeFirebase(): Promise<void> {
  try {
    console.log('🔥 Initializing Firebase...');
    
    // Get config from backend
    const config: AppConfig = await configService.getConfig();
    
    // Initialize Firebase app
    app = initializeApp(config.firebase);
    
    // Initialize services
    auth = getAuth(app);
    
    // Enable auth persistence for browser sessions - this is critical
    try {
      await setPersistence(auth, browserLocalPersistence);
      console.log('✅ Auth persistence enabled');
      
      // Also set in localStorage for extra persistence
      localStorage.setItem('f2p-auth-persistence', 'enabled');
    } catch (error) {
      console.warn('⚠️ Auth persistence failed:', error);
    }
    
    db = getFirestore(app);
    storage = getStorage(app);
    
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
    
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    throw error;
  }
}

// Get Firebase Auth instance (initializes if needed)
export async function getAuthInstance(): Promise<Auth> {
  await ensureFirebaseInitialized();
  if (!auth) {
    throw new Error('Failed to initialize Firebase Auth');
  }
  return auth;
}

// Get Firestore instance (initializes if needed)
export async function getFirestoreInstance(): Promise<Firestore> {
  await ensureFirebaseInitialized();
  if (!db) {
    throw new Error('Failed to initialize Firestore');
  }
  return db;
}

// Get Storage instance (initializes if needed)
export async function getStorageInstance(): Promise<FirebaseStorage> {
  await ensureFirebaseInitialized();
  if (!storage) {
    throw new Error('Failed to initialize Firebase Storage');
  }
  return storage;
}

// Get Firebase app instance (initializes if needed)
export async function getFirebaseApp(): Promise<FirebaseApp> {
  await ensureFirebaseInitialized();
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
      // Preserve auth state after reCAPTCHA verification
      import('../utils/authPersistence').then(({ getPersistedAuthState, saveAuthState }) => {
        const persistedAuth = getPersistedAuthState();
        if (persistedAuth) {
          console.log('Re-saving auth state after reCAPTCHA');
          saveAuthState(persistedAuth);
        }
      });
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

// Initialize Firebase when this module loads (but only once)
let initializationPromise: Promise<void> | null = null;

// Ensure Firebase is initialized only once
export const ensureFirebaseInitialized = async (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = initializeFirebase();
  }
  return initializationPromise;
};

// Auto-initialize when module loads
ensureFirebaseInitialized().catch(console.error);

// Export instances (will be null until initialized - use getters instead)
export { auth, db, storage };

export default app;