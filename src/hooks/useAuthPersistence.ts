import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setUser, setLoading } from '../store/slices/authSlice';
import { setOrganization } from '../store/slices/organizationSlice';
import { 
  getPersistedAuthState, 
  getPersistedOrgState, 
  hasValidPersistedAuth,
  saveAuthState 
} from '../utils/authPersistence';

// Hook to aggressively maintain auth persistence
export const useAuthPersistence = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Run immediately on hook mount
    const restoreAuthIfNeeded = () => {
      const persistedAuth = getPersistedAuthState();
      const persistedOrg = getPersistedOrgState();
      
      if (persistedAuth && hasValidPersistedAuth()) {
        console.log('🔄 useAuthPersistence: Restoring auth state');
        dispatch(setUser(persistedAuth));
        
        if (persistedOrg) {
          dispatch(setOrganization(persistedOrg));
        }
        
        dispatch(setLoading(false));
        return true;
      }
      return false;
    };

    // Initial restore
    restoreAuthIfNeeded();

    // Set up interval to check and restore auth every 2 seconds
    const authCheckInterval = setInterval(() => {
      restoreAuthIfNeeded();
    }, 2000);

    // Restore on visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        restoreAuthIfNeeded();
      }
    };

    // Restore on page focus
    const handlePageFocus = () => {
      restoreAuthIfNeeded();
    };

    // Restore on storage changes (other tabs)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'f2p_auth_state' && event.newValue) {
        console.log('🔄 Auth state changed in another tab, syncing...');
        restoreAuthIfNeeded();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handlePageFocus);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(authCheckInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handlePageFocus);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [dispatch]);

  // Function to force auth restoration
  const forceAuthRestore = () => {
    const persistedAuth = getPersistedAuthState();
    const persistedOrg = getPersistedOrgState();
    
    if (persistedAuth && hasValidPersistedAuth()) {
      console.log('🔄 FORCE restoring auth state');
      dispatch(setUser(persistedAuth));
      
      if (persistedOrg) {
        dispatch(setOrganization(persistedOrg));
      }
      
      dispatch(setLoading(false));
      return true;
    }
    return false;
  };

  return { forceAuthRestore };
};