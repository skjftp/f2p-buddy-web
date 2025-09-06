import React, { createContext, useContext, useEffect } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useDispatch, useSelector } from 'react-redux';
import { getAuthInstance, getFirestoreInstance } from '../config/firebase';
import { setUser, clearUser, setLoading } from '../store/slices/authSlice';
import { setOrganization, clearOrganization } from '../store/slices/organizationSlice';
import { RootState } from '../store/store';

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
    dispatch(setLoading(true));
    let isSubscribed = true;
    let mounted = true;

    // Initialize auth listener after Firebase is ready
    const initializeAuthListener = async (): Promise<(() => void) | undefined> => {
      try {
        if (!isSubscribed || !mounted) return undefined;
        
        const authInstance = await getAuthInstance();
        
        const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser: User | null) => {
          if (!mounted) return;
          
          if (firebaseUser) {
            try {
              // Get user data from Firestore with retry logic
              const dbInstance = await getFirestoreInstance();
              const userDocRef = doc(dbInstance, 'users', firebaseUser.uid);
              
              let retries = 3;
              let userDoc;
              
              while (retries > 0) {
                try {
                  userDoc = await getDoc(userDocRef);
                  break;
                } catch (error) {
                  retries--;
                  if (retries === 0) throw error;
                  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
                }
              }
              
              if (userDoc && userDoc.exists()) {
                const userData = userDoc.data();
                dispatch(setUser({
                  uid: firebaseUser.uid,
                  phoneNumber: firebaseUser.phoneNumber || userData.phoneNumber,
                  role: userData.role,
                  organizationId: userData.organizationId,
                  displayName: userData.displayName,
                  createdAt: userData.createdAt,
                }));

                // Load organization data if user has organizationId
                if (userData.organizationId) {
                  try {
                    const orgDocRef = doc(dbInstance, 'organizations', userData.organizationId);
                    const orgDoc = await getDoc(orgDocRef);
                    if (orgDoc.exists()) {
                      dispatch(setOrganization({
                        id: orgDoc.id,
                        ...orgDoc.data(),
                      } as any));
                    }
                  } catch (orgError) {
                    console.warn('Could not load organization:', orgError);
                    // Don't clear user if org loading fails
                  }
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
            dispatch(clearUser());
            dispatch(clearOrganization());
          }
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Failed to initialize auth listener:', error);
        dispatch(clearUser());
        return undefined;
      }
    };
    
    let unsubscribe: (() => void) | null = null;
    initializeAuthListener().then(unsub => {
      if (unsub) {
        unsubscribe = unsub;
      }
    });
    
    return () => {
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
    } catch (error) {
      console.error('Error signing out:', error);
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