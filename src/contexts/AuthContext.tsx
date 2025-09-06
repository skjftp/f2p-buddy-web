import React, { createContext, useContext, useEffect } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, query, where, getDocs, collection, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useDispatch, useSelector } from 'react-redux';
import { getAuthInstance, getFirestoreInstance } from '../config/firebase';
import { setUser, clearUser, setLoading } from '../store/slices/authSlice';
import { setOrganization, clearOrganization } from '../store/slices/organizationSlice';
import { RootState } from '../store/store';
import { 
  saveAuthState, 
  getPersistedAuthState, 
  getPersistedOrgState, 
  clearPersistedAuthState,
  hasValidPersistedAuth 
} from '../utils/authPersistence';

interface AuthContextType {
  user: any;
  organization: any;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state: RootState) => state.auth);
  const { current: organization } = useSelector((state: RootState) => state.organization);

  useEffect(() => {
    let isSubscribed = true;
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    
    // IMMEDIATELY restore auth state from localStorage to prevent logout
    const persistedAuth = getPersistedAuthState();
    const persistedOrg = getPersistedOrgState();
    
    if (persistedAuth && hasValidPersistedAuth()) {
      console.log('✅ IMMEDIATELY restoring auth from localStorage');
      dispatch(setUser(persistedAuth));
      
      if (persistedOrg) {
        dispatch(setOrganization(persistedOrg));
      }
      
      dispatch(setLoading(false));
      
      // Don't set loading=true if we have persisted auth
    } else {
      console.log('🔍 No persisted auth, starting fresh login flow');
      dispatch(setLoading(true));
    }
    
    // Add delay to ensure Firebase is fully initialized
    const initDelay = setTimeout(() => {

    // Initialize auth listener after Firebase is ready
    const initializeAuthListener = async (): Promise<(() => void) | undefined> => {
      try {
        if (!isSubscribed || !mounted) return undefined;
        
        const authInstance = await getAuthInstance();
        
        const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser: User | null) => {
          if (!mounted) return;
          
          if (firebaseUser) {
            console.log('🔑 Firebase user authenticated:', {
              uid: firebaseUser.uid,
              phoneNumber: firebaseUser.phoneNumber,
              isAnonymous: firebaseUser.isAnonymous
            });
            try {
              // Get user data from Firestore using phone number as document ID
              const dbInstance = await getFirestoreInstance();
              
              console.log('📞 Looking up user by phone number:', firebaseUser.phoneNumber);
              const userDocRef = doc(dbInstance, 'users', firebaseUser.phoneNumber);
              const userDoc = await getDoc(userDocRef);
              
              if (userDoc.exists()) {
                console.log('✅ Found user by phone number:', userDoc.id);
                
                // Update the document with Firebase UID if not already set
                const userData = userDoc.data();
                if (!userData.uid) {
                  console.log('📝 Updating document with Firebase UID...');
                  await updateDoc(userDocRef, {
                    uid: firebaseUser.uid,
                    updatedAt: serverTimestamp()
                  });
                  console.log('✅ Document updated with Firebase UID');
                }
              } else {
                console.log('❌ No user document found for phone:', firebaseUser.phoneNumber);
              }
              
              if (userDoc && userDoc.exists()) {
                const userData = userDoc.data();
                console.log('📋 Processing user data:', {
                  uid: firebaseUser.uid,
                  phoneNumber: userData.phoneNumber,
                  role: userData.role,
                  organizationId: userData.organizationId,
                  displayName: userData.displayName
                });
                
                const userStateData = {
                  uid: firebaseUser.uid,
                  phoneNumber: firebaseUser.phoneNumber || userData.phoneNumber,
                  role: userData.role,
                  organizationId: userData.organizationId,
                  displayName: userData.displayName,
                  createdAt: userData.createdAt,
                };
                
                console.log('💾 Setting user state with organizationId:', userData.organizationId);
                dispatch(setUser(userStateData));

                // Load organization data if user has organizationId
                if (userData.organizationId) {
                  try {
                    const orgDocRef = doc(dbInstance, 'organizations', userData.organizationId);
                    const orgDoc = await getDoc(orgDocRef);
                    if (orgDoc.exists()) {
                      const orgData = {
                        id: orgDoc.id,
                        ...orgDoc.data(),
                      };
                      dispatch(setOrganization(orgData as any));
                      
                      // Save both user and org state to localStorage
                      saveAuthState(userStateData, orgData);
                    }
                  } catch (orgError) {
                    console.warn('Could not load organization:', orgError);
                    // Save user state even if org loading fails
                    saveAuthState(userStateData);
                  }
                } else {
                  // Save user state without org
                  saveAuthState(userStateData);
                }
              } else {
                // User exists in auth but not in Firestore - this is OK during registration
              console.log('User authenticated but no Firestore document yet');
              
              // Set basic user data to prevent logout
              dispatch(setUser({
                uid: firebaseUser.uid,
                phoneNumber: firebaseUser.phoneNumber || '',
                role: 'employee', // Default role
                organizationId: '',
                displayName: '',
                createdAt: null,
              }));
              }
            } catch (error) {
              console.error('Error loading user data:', error);
              // Don't clear user on Firestore errors - keep them authenticated
              console.log('Keeping user authenticated despite Firestore error');
              
              // Set minimal user data to prevent logout
              dispatch(setUser({
                uid: firebaseUser.uid,
                phoneNumber: firebaseUser.phoneNumber || '',
                role: 'employee', // Default role to prevent routing issues
                organizationId: '',
                displayName: '',
                createdAt: null,
              }));
            }
          } else {
            // Only clear if we don't have persisted auth AND this is not just a temporary Firebase issue
            const currentPersistedAuth = getPersistedAuthState();
            if (!currentPersistedAuth || !hasValidPersistedAuth()) {
              console.log('🚪 No valid auth found, clearing state');
              dispatch(clearUser());
              dispatch(clearOrganization());
              clearPersistedAuthState();
            } else {
              console.log('🔒 Keeping persisted auth despite Firebase state null');
              // Keep the persisted auth active
            }
          }
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Failed to initialize auth listener:', error);
        dispatch(clearUser());
        return undefined;
      }
    };
    
    initializeAuthListener().then(unsub => {
      if (unsub && mounted) {
        unsubscribe = unsub;
      }
    });
    }, 500); // 500ms delay to ensure Firebase is ready
    
    return () => {
      clearTimeout(initDelay);
      mounted = false;
      isSubscribed = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [dispatch]);

  const logout = async () => {
    try {
      const authInstance = await getAuthInstance();
      await signOut(authInstance);
      dispatch(clearUser());
      dispatch(clearOrganization());
      clearPersistedAuthState();
      console.log('✅ User logged out and auth state cleared');
    } catch (error) {
      console.error('Error signing out:', error);
      // Clear local state anyway
      dispatch(clearUser());
      dispatch(clearOrganization());
      clearPersistedAuthState();
    }
  };

  const value: AuthContextType = {
    user,
    organization,
    loading,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};