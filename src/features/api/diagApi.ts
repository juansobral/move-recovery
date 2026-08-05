import type { DiagResponse } from '../../types/diag.types';
import { baseApi } from './baseApi';

export const diagApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDiag: builder.query<DiagResponse, { test?: string } | void>({
      query: (args) => ({ url: '/diag', method: 'GET', params: args?.test ? { test: args.test } : undefined }),
    }),
  }),
});

export const { useLazyGetDiagQuery } = diagApi;
