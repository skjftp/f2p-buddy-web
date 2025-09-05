import React, { createContext, useContext, useEffect } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useDispatch, useSelector } from 'react-redux';
import { auth, db } from '../config/firebase';
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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          // Get user data from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
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
              const orgDocRef = doc(db, 'organizations', userData.organizationId);
              const orgDoc = await getDoc(orgDocRef);
              if (orgDoc.exists()) {
                dispatch(setOrganization({
                  id: orgDoc.id,
                  ...orgDoc.data(),
                } as any));
              }
            }
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          dispatch(clearUser());
        }
      } else {
        dispatch(clearUser());
        dispatch(clearOrganization());
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  const logout = async () => {
    try {
      await signOut(auth);
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