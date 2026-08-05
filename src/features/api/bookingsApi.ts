import type { Booking, CancelBookingResponse, CreateBookingRequest, CreateBookingResponse } from '../../types/booking.types';
import { baseApi } from './baseApi';

export const bookingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBookings: builder.query<Booking[], void>({
      query: () => ({ url: '/bookings', method: 'GET' }),
      providesTags: ['Booking'],
    }),
    createBooking: builder.mutation<CreateBookingResponse, CreateBookingRequest>({
      query: (body) => ({ url: '/bookings', method: 'POST', data: body }),
    }),
    cancelBooking: builder.mutation<CancelBookingResponse, { id: number; notify: boolean }>({
      query: ({ id, notify }) => ({ url: '/bookings', method: 'DELETE', params: { id, notify: notify ? 1 : 0 } }),
      invalidatesTags: ['Booking'],
    }),
  }),
});

export const { useGetBookingsQuery, useCreateBookingMutation, useCancelBookingMutation } = bookingsApi;
