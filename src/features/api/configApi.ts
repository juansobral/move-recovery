import type { BookingConfig } from '../../types/booking.types';
import { baseApi } from './baseApi';

export const configApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getConfig: builder.query<BookingConfig, void>({
      query: () => ({ url: '/config', method: 'GET' }),
    }),
  }),
});

export const { useGetConfigQuery } = configApi;
