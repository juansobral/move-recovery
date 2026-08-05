import axios, { AxiosError } from 'axios';
import { loggedOut } from '../features/userAuth/userAuthSlice';
import { store } from '../store/store';

export const userApiClient = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api' });

userApiClient.interceptors.request.use((config) => {
  const token = store.getState().userAuth.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

userApiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) store.dispatch(loggedOut());
    return Promise.reject(error);
  },
);
