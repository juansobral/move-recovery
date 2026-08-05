import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosError, AxiosRequestConfig, Method } from 'axios';
import { userApiClient } from './userAxios';
import type { ApiErrorShape } from './axiosBaseQuery';

export interface UserAxiosBaseQueryArgs {
  url: string;
  method: Method;
  data?: unknown;
  params?: unknown;
}

export const userAxiosBaseQuery = (): BaseQueryFn<UserAxiosBaseQueryArgs, unknown, ApiErrorShape> => {
  return async ({ url, method, data, params }) => {
    try {
      const result = await userApiClient({ url, method, data, params } as AxiosRequestConfig);
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
