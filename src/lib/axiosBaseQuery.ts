import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosError, AxiosRequestConfig, Method } from 'axios';
import { apiClient } from './axios';

export interface ApiErrorShape {
  status?: number;
  error: string;
}

export interface AxiosBaseQueryArgs {
  url: string;
  method: Method;
  data?: unknown;
  params?: unknown;
}

export const axiosBaseQuery = (): BaseQueryFn<AxiosBaseQueryArgs, unknown, ApiErrorShape> => {
  return async ({ url, method, data, params }) => {
    try {
      const result = await apiClient({ url, method, data, params } as AxiosRequestConfig);
      return { data: result.data };
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: string }>;
      return {
        error: {
          status: axiosError.response?.status,
          error: axiosError.response?.data?.error ?? 'Error de conexión. Intentá nuevamente.',
        },
      };
    }
  };
};
