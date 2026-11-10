import {createSlice, PayloadAction} from '@reduxjs/toolkit';

// Mirrors the public.profiles table (supabase/migrations).
export interface User {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthState {
  user: User | null;
  session: any | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
};

const userSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setSession: (state, action: PayloadAction<any>) => {
      state.session = action.payload;
    },
    updateUserProfile: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = {...state.user, ...action.payload};
      }
    },
    clearAuth: state => {
      state.user = null;
      state.session = null;
      state.isAuthenticated = false;
    },
  },
});

export const {setUser, setSession, updateUserProfile, clearAuth} = userSlice.actions;

export default userSlice.reducer;
