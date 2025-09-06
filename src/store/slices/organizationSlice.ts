import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Organization {
  id: string;
  name: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  adminId: string;
  settings: {
    allowSelfRegistration: boolean;
    requireApproval: boolean;
    timezone: string;
  };
  createdAt: any;
}

interface OrganizationState {
  current: Organization | null;
  loading: boolean;
  error: string | null;
}

// IMMEDIATELY restore organization from localStorage
const restoreOrgFromStorage = (): Organization | null => {
  try {
    const stored = localStorage.getItem('f2p_org_state');
    if (stored) {
      const orgData = JSON.parse(stored);
      console.log('🔄 IMMEDIATELY restored org from localStorage');
      return orgData;
    }
  } catch (error) {
    console.warn('Failed to restore org from localStorage:', error);
  }
  return null;
};

const restoredOrg = restoreOrgFromStorage();

const initialState: OrganizationState = {
  current: restoredOrg,
  loading: false,
  error: null,
};

const organizationSlice = createSlice({
  name: 'organization',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setOrganization: (state, action: PayloadAction<Organization>) => {
      state.current = action.payload;
      state.loading = false;
      state.error = null;
    },
    updateOrganization: (state, action: PayloadAction<Partial<Organization>>) => {
      if (state.current) {
        state.current = { ...state.current, ...action.payload };
      }
    },
    clearOrganization: (state) => {
      state.current = null;
      state.loading = false;
      state.error = null;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const { 
  setLoading, 
  setOrganization, 
  updateOrganization, 
  clearOrganization, 
  setError 
} = organizationSlice.actions;

export default organizationSlice.reducer;