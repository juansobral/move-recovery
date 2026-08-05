import type { AvailabilityResponse } from '../../types/booking.types';
import { baseApi } from './baseApi';

export const availabilityApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAvailability: builder.query<AvailabilityResponse, string>({
      query: (date) => ({ url: '/availability', method: 'GET', params: { date } }),
    }),
  }),
});

export const { useGetAvailabilityQuery } = availabilityApi;
