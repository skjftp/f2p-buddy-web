import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  banner?: string;
  type: ('sales' | 'calls' | 'meetings' | 'referrals')[];
  metrics: {
    sales?: { target: number; achieved: number; };
    calls?: { target: number; achieved: number; };
    meetings?: { target: number; achieved: number; };
    referrals?: { target: number; achieved: number; };
  };
  prizes: {
    position: number;
    title: string;
    description: string;
    image?: string;
  }[];
  participants: string[];
  orgId: string;
  createdBy: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  createdAt: any;
  updatedAt: any;
}

interface CampaignState {
  campaigns: Campaign[];
  currentCampaign: Campaign | null;
  loading: boolean;
  error: string | null;
}

const initialState: CampaignState = {
  campaigns: [],
  currentCampaign: null,
  loading: false,
  error: null,
};

const campaignSlice = createSlice({
  name: 'campaign',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setCampaigns: (state, action: PayloadAction<Campaign[]>) => {
      state.campaigns = action.payload;
      state.loading = false;
      state.error = null;
    },
    addCampaign: (state, action: PayloadAction<Campaign>) => {
      state.campaigns.push(action.payload);
    },
    updateCampaign: (state, action: PayloadAction<{ id: string; updates: Partial<Campaign> }>) => {
      const index = state.campaigns.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.campaigns[index] = { ...state.campaigns[index], ...action.payload.updates };
      }
      if (state.currentCampaign && state.currentCampaign.id === action.payload.id) {
        state.currentCampaign = { ...state.currentCampaign, ...action.payload.updates };
      }
    },
    setCurrentCampaign: (state, action: PayloadAction<Campaign>) => {
      state.currentCampaign = action.payload;
    },
    clearCurrentCampaign: (state) => {
      state.currentCampaign = null;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const { 
  setLoading, 
  setCampaigns, 
  addCampaign, 
  updateCampaign, 
  setCurrentCampaign,
  clearCurrentCampaign,
  setError 
} = campaignSlice.actions;

export default campaignSlice.reducer;