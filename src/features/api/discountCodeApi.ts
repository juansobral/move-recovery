import type { DiscountCodeSettings } from '../../types/booking.types';
import { baseApi } from './baseApi';

export const discountCodeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminDiscountCode: builder.query<DiscountCodeSettings, void>({
      query: () => ({ url: '/admin/discount-code', method: 'GET' }),
      providesTags: ['Config'],
    }),
    updateDiscountCode: builder.mutation<DiscountCodeSettings, DiscountCodeSettings>({
      query: (data) => ({ url: '/admin/discount-code', method: 'PUT', data }),
      invalidatesTags: ['Config'],
    }),
  }),
});

export const { useGetAdminDiscountCodeQuery, useUpdateDiscountCodeMutation } = discountCodeApi;
