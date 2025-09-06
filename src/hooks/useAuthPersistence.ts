import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setUser, setLoading } from '../store/slices/authSlice';
import { setOrganization } from '../store/slices/organizationSlice';
import { 
  getPersistedAuthState, 
  getPersistedOrgState, 
  hasValidPersistedAuth
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
        // Only log once per session to reduce console noise
        const lastLogTime = parseInt(sessionStorage.getItem('f2p_last_restore_log') || '0');
        const currentTime = Date.now();
        
        if (currentTime - lastLogTime > 60000) { // Log once per minute max
          console.log('🔄 useAuthPersistence: Restoring auth state');
          sessionStorage.setItem('f2p_last_restore_log', currentTime.toString());
        }
        
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

    // Set up interval to check and restore auth every 30 seconds (much less frequent)
    const authCheckInterval = setInterval(() => {
      const currentTime = Date.now();
      const lastCheck = parseInt(localStorage.getItem('f2p_last_auth_check') || '0');
      
      // Only run if 30 seconds have passed
      if (currentTime - lastCheck > 30000) {
        restoreAuthIfNeeded();
        localStorage.setItem('f2p_last_auth_check', currentTime.toString());
      }
    }, 30000);

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