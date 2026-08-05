import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../store/store';

const TOKEN_KEY = 'move_user_token';
const PROFILE_COMPLETE_KEY = 'move_user_profile_complete';

interface UserAuthState {
  token: string | null;
  profileComplete: boolean;
}

const initialState: UserAuthState = {
  token: localStorage.getItem(TOKEN_KEY),
  profileComplete: localStorage.getItem(PROFILE_COMPLETE_KEY) === 'true',
};

const userAuthSlice = createSlice({
  name: 'userAuth',
  initialState,
  reducers: {
    credentialsSet: (state, action: PayloadAction<{ token: string; profileComplete: boolean }>) => {
      state.token = action.payload.token;
      state.profileComplete = action.payload.profileComplete;
      localStorage.setItem(TOKEN_KEY, action.payload.token);
      localStorage.setItem(PROFILE_COMPLETE_KEY, String(action.payload.profileComplete));
    },
    profileCompleted: (state) => {
      state.profileComplete = true;
      localStorage.setItem(PROFILE_COMPLETE_KEY, 'true');
    },
    loggedOut: (state) => {
      state.token = null;
      state.profileComplete = false;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PROFILE_COMPLETE_KEY);
    },
  },
});

export const { credentialsSet, profileCompleted, loggedOut } = userAuthSlice.actions;
export const selectCustomerToken = (state: RootState): string | null => state.userAuth.token;
export const selectIsCustomerAuthenticated = (state: RootState): boolean => Boolean(state.userAuth.token);
export const selectProfileComplete = (state: RootState): boolean => state.userAuth.profileComplete;
export const userAuthReducer = userAuthSlice.reducer;
