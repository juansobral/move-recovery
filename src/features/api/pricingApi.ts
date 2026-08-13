import type { PricingConfig } from '../../types/booking.types';
import { baseApi } from './baseApi';

export const pricingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminPricing: builder.query<PricingConfig, void>({
      query: () => ({ url: '/admin/pricing', method: 'GET' }),
      providesTags: ['Config'],
    }),
    updatePricing: builder.mutation<PricingConfig, PricingConfig>({
      query: (data) => ({ url: '/admin/pricing', method: 'PUT', data }),
      invalidatesTags: ['Config'],
    }),
  }),
});

export const { useGetAdminPricingQuery, useUpdatePricingMutation } = pricingApi;
