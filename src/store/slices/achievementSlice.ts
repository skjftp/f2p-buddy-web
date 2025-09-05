import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Achievement {
  id: string;
  userId: string;
  campaignId: string;
  type: 'sales' | 'calls' | 'meetings' | 'referrals';
  value: number;
  description: string;
  dateAchieved: string;
  verified: boolean;
  verifiedBy?: string;
  evidence?: {
    type: 'image' | 'document';
    url: string;
  };
}

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalScore: number;
  achievements: Achievement[];
  position: number;
}

interface AchievementState {
  achievements: Achievement[];
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
}

const initialState: AchievementState = {
  achievements: [],
  leaderboard: [],
  loading: false,
  error: null,
};

const achievementSlice = createSlice({
  name: 'achievement',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setAchievements: (state, action: PayloadAction<Achievement[]>) => {
      state.achievements = action.payload;
      state.loading = false;
      state.error = null;
    },
    addAchievement: (state, action: PayloadAction<Achievement>) => {
      state.achievements.push(action.payload);
    },
    updateAchievement: (state, action: PayloadAction<{ id: string; updates: Partial<Achievement> }>) => {
      const index = state.achievements.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.achievements[index] = { ...state.achievements[index], ...action.payload.updates };
      }
    },
    setLeaderboard: (state, action: PayloadAction<LeaderboardEntry[]>) => {
      state.leaderboard = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const { 
  setLoading, 
  setAchievements, 
  addAchievement, 
  updateAchievement, 
  setLeaderboard,
  setError 
} = achievementSlice.actions;

export default achievementSlice.reducer;