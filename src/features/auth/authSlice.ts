import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../store/store';

const STORAGE_KEY = 'move_admin_token';

interface AuthState {
  token: string | null;
}

const initialState: AuthState = {
  token: localStorage.getItem(STORAGE_KEY),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsSet: (state, action: PayloadAction<{ token: string }>) => {
      state.token = action.payload.token;
      localStorage.setItem(STORAGE_KEY, action.payload.token);
    },
    loggedOut: (state) => {
      state.token = null;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
});

export const { credentialsSet, loggedOut } = authSlice.actions;
export const selectToken = (state: RootState): string | null => state.auth.token;
export const selectIsAuthenticated = (state: RootState): boolean => Boolean(state.auth.token);
export const authReducer = authSlice.reducer;
