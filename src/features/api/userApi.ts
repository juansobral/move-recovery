import { createApi } from '@reduxjs/toolkit/query/react';
import { userAxiosBaseQuery } from '../../lib/userAxiosBaseQuery';
import type { Booking, CreateBookingRequest, CreateBookingResponse } from '../../types/booking.types';
import type { GoogleLoginResponse, UserProfile } from '../../types/user.types';

export const userApi = createApi({
  reducerPath: 'userApi',
  baseQuery: userAxiosBaseQuery(),
  tagTypes: ['MyBookings'],
  endpoints: (builder) => ({
    loginWithGoogle: builder.mutation<GoogleLoginResponse, { idToken: string }>({
      query: (body) => ({ url: '/users/auth/google', method: 'POST', data: body }),
    }),
    getMe: builder.query<UserProfile, void>({
      query: () => ({ url: '/users/me', method: 'GET' }),
    }),
    completeProfile: builder.mutation<UserProfile, { phone: string }>({
      query: (body) => ({ url: '/users/me', method: 'PATCH', data: body }),
    }),
    getMyBookings: builder.query<Booking[], void>({
      query: () => ({ url: '/users/me/bookings', method: 'GET' }),
      providesTags: ['MyBookings'],
    }),
    createBooking: builder.mutation<CreateBookingResponse, CreateBookingRequest>({
      query: (body) => ({ url: '/bookings', method: 'POST', data: body }),
      invalidatesTags: ['MyBookings'],
    }),
  }),
});

export const {
  useLoginWithGoogleMutation,
  useGetMeQuery,
  useCompleteProfileMutation,
  useGetMyBookingsQuery,
  useCreateBookingMutation,
} = userApi;
