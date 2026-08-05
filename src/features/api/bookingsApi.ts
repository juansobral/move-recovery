import type { Booking, CancelBookingResponse } from '../../types/booking.types';
import { baseApi } from './baseApi';

export const bookingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBookings: builder.query<Booking[], void>({
      query: () => ({ url: '/bookings', method: 'GET' }),
      providesTags: ['Booking'],
    }),
    cancelBooking: builder.mutation<CancelBookingResponse, { id: number; notify: boolean }>({
      query: ({ id, notify }) => ({ url: '/bookings', method: 'DELETE', params: { id, notify: notify ? 1 : 0 } }),
      invalidatesTags: ['Booking'],
    }),
  }),
});

export const { useGetBookingsQuery, useCancelBookingMutation } = bookingsApi;
