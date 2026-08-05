import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '../features/auth/authSlice';
import { userAuthReducer } from '../features/userAuth/userAuthSlice';
import { baseApi } from '../features/api/baseApi';
import { userApi } from '../features/api/userApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    userAuth: userAuthReducer,
    [baseApi.reducerPath]: baseApi.reducer,
    [userApi.reducerPath]: userApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware, userApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
