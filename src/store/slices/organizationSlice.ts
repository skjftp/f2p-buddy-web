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

const initialState: OrganizationState = {
  current: null,
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