import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setUser, setLoading } from '../../store/slices/authSlice';
import { setOrganization } from '../../store/slices/organizationSlice';
import { getPersistedAuthState, getPersistedOrgState, hasValidPersistedAuth } from '../../utils/authPersistence';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Aggressively restore auth state on every component mount
    const restoreAuth = () => {
      const persistedAuth = getPersistedAuthState();
      const persistedOrg = getPersistedOrgState();
      
      if (persistedAuth && hasValidPersistedAuth()) {
        console.log('🛡️ AuthGuard: Restoring auth state');
        dispatch(setUser(persistedAuth));
        
        if (persistedOrg) {
          dispatch(setOrganization(persistedOrg));
        }
        
        dispatch(setLoading(false));
      }
    };

    restoreAuth();
    
    // Also restore on focus (when user returns to tab)
    const handleFocus = () => {
      restoreAuth();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [dispatch]);

  return <>{children}</>;
};

export default AuthGuard;