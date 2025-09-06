import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  uid: string;
  phoneNumber: string;
  role: 'admin' | 'employee';
  organizationId?: string;
  displayName?: string;
  createdAt?: any;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

// IMMEDIATELY restore auth state from localStorage before Redux even initializes
const restoreAuthFromStorage = (): User | null => {
  try {
    const stored = localStorage.getItem('f2p_auth_state');
    if (stored) {
      const authState = JSON.parse(stored);
      const hoursSinceStored = (Date.now() - authState.timestamp) / (1000 * 60 * 60);
      
      if (hoursSinceStored < 24 && authState.uid && authState.role) {
        console.log('🔄 IMMEDIATELY restored auth from localStorage');
        return authState;
      }
    }
  } catch (error) {
    console.warn('Failed to restore auth from localStorage:', error);
  }
  return null;
};

const restoredUser = restoreAuthFromStorage();

const initialState: AuthState = {
  user: restoredUser,
  isAuthenticated: !!restoredUser,
  loading: !restoredUser, // Don't show loading if we have restored user
  error: null,
  initialized: !!restoredUser,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
      state.initialized = true;
      
      // IMMEDIATELY save to localStorage
      try {
        localStorage.setItem('f2p_auth_state', JSON.stringify({
          ...action.payload,
          timestamp: Date.now()
        }));
        console.log('✅ Auth state saved to localStorage');
      } catch (error) {
        console.warn('Failed to save auth state:', error);
      }
    },
    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      state.initialized = true;
      
      // Clear localStorage
      try {
        localStorage.removeItem('f2p_auth_state');
        localStorage.removeItem('f2p_org_state');
        console.log('🗑️ Auth state cleared from localStorage');
      } catch (error) {
        console.warn('Failed to clear auth state:', error);
      }
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        
        // Update localStorage immediately
        try {
          localStorage.setItem('f2p_auth_state', JSON.stringify({
            ...state.user,
            timestamp: Date.now()
          }));
        } catch (error) {
          console.warn('Failed to update auth state:', error);
        }
      }
    },
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.initialized = action.payload;
    }
  },
});

export const { setLoading, setUser, clearUser, setError, updateUser, setInitialized } = authSlice.actions;
export default authSlice.reducer;