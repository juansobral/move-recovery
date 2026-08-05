import axios, { AxiosError } from 'axios';
import { loggedOut } from '../features/auth/authSlice';
import { store } from '../store/store';

export const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api' });

apiClient.interceptors.request.use((config) => {
  const token = store.getState().auth.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      store.dispatch(loggedOut());
      if (window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
        window.location.assign('/admin/login');
      }
    }
    return Promise.reject(error);
  },
);
