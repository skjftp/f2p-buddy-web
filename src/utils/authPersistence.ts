// Auth persistence utilities to prevent logout on reload

interface PersistedAuthState {
  uid: string;
  phoneNumber: string;
  role: 'admin' | 'employee';
  organizationId?: string;
  displayName?: string;
  timestamp: number;
}

const AUTH_STORAGE_KEY = 'f2p_auth_state';
const ORG_STORAGE_KEY = 'f2p_org_state';
const AUTH_EXPIRY_HOURS = 24; // 24 hours

export const saveAuthState = (user: any, organization?: any) => {
  try {
    const authState: PersistedAuthState = {
      uid: user.uid,
      phoneNumber: user.phoneNumber,
      role: user.role,
      organizationId: user.organizationId,
      displayName: user.displayName,
      timestamp: Date.now()
    };
    
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
    
    if (organization) {
      localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(organization));
    }
    
    console.log('✅ Auth state saved to localStorage');
  } catch (error) {
    console.warn('Failed to save auth state:', error);
  }
};

export const getPersistedAuthState = (): PersistedAuthState | null => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    
    const authState: PersistedAuthState = JSON.parse(stored);
    
    // Check if auth state has expired
    const hoursSinceStored = (Date.now() - authState.timestamp) / (1000 * 60 * 60);
    if (hoursSinceStored > AUTH_EXPIRY_HOURS) {
      console.log('Auth state expired, clearing...');
      clearPersistedAuthState();
      return null;
    }
    
    return authState;
  } catch (error) {
    console.warn('Failed to get persisted auth state:', error);
    return null;
  }
};

export const getPersistedOrgState = (): any | null => {
  try {
    const stored = localStorage.getItem(ORG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to get persisted org state:', error);
    return null;
  }
};

export const clearPersistedAuthState = () => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(ORG_STORAGE_KEY);
    console.log('✅ Auth state cleared from localStorage');
  } catch (error) {
    console.warn('Failed to clear auth state:', error);
  }
};

export const hasValidPersistedAuth = (): boolean => {
  const authState = getPersistedAuthState();
  return authState !== null && !!authState.uid && !!authState.role;
};