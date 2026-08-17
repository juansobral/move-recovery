import { createApi } from '@reduxjs/toolkit/query/react';
import { userAxiosBaseQuery } from '../../lib/userAxiosBaseQuery';
import type { Booking, CreateBookingRequest } from '../../types/booking.types';
import type { CheckoutResult, CheckoutStatus, Subscription } from '../../types/subscription.types';
import type { GoogleLoginResponse, UserProfile } from '../../types/user.types';

export const userApi = createApi({
  reducerPath: 'userApi',
  baseQuery: userAxiosBaseQuery(),
  tagTypes: ['MyBookings', 'MySubscription', 'Me'],
  endpoints: (builder) => ({
    loginWithGoogle: builder.mutation<GoogleLoginResponse, { idToken: string }>({
      query: (body) => ({ url: '/users/auth/google', method: 'POST', data: body }),
    }),
    getMe: builder.query<UserProfile, void>({
      query: () => ({ url: '/users/me', method: 'GET' }),
      providesTags: ['Me'],
    }),
    completeProfile: builder.mutation<UserProfile, { phone: string }>({
      query: (body) => ({ url: '/users/me', method: 'PATCH', data: body }),
    }),
    getMyBookings: builder.query<Booking[], void>({
      query: () => ({ url: '/users/me/bookings', method: 'GET' }),
      providesTags: ['MyBookings'],
    }),
    createBookingCheckout: builder.mutation<CheckoutResult, CreateBookingRequest>({
      query: (body) => ({ url: '/bookings/checkout', method: 'POST', data: body }),
      // La reserva cubierta por crédito descuenta sessionCreditsRemaining en el
      // server, así que el plan cacheado también queda viejo. Una sesión suelta
      // pagada también cambia la elegibilidad al precio de primera sesión.
      invalidatesTags: ['MyBookings', 'MySubscription', 'Me'],
    }),
    createSubscriptionCheckout: builder.mutation<
      { initPoint: string; reference: string },
      { plan: 'standard' | 'premium'; intendedBooking?: CreateBookingRequest }
    >({
      query: (body) => ({ url: '/subscriptions/checkout', method: 'POST', data: body }),
    }),
    getCheckoutStatus: builder.query<CheckoutStatus, string>({
      query: (ref) => ({ url: '/bookings/checkout-status', method: 'GET', params: { ref } }),
    }),
    getMySubscription: builder.query<Subscription | null, void>({
      query: () => ({ url: '/subscriptions/me', method: 'GET' }),
      transformResponse: (response: Subscription | '' | null) => (response ? response : null),
      providesTags: ['MySubscription'],
    }),
    cancelSubscription: builder.mutation<{ ok: true }, void>({
      query: () => ({ url: '/subscriptions/me', method: 'DELETE' }),
      invalidatesTags: ['MySubscription'],
    }),
  }),
});

export const {
  useLoginWithGoogleMutation,
  useGetMeQuery,
  useCompleteProfileMutation,
  useGetMyBookingsQuery,
  useCreateBookingCheckoutMutation,
  useCreateSubscriptionCheckoutMutation,
  useGetCheckoutStatusQuery,
  useLazyGetCheckoutStatusQuery,
  useGetMySubscriptionQuery,
  useCancelSubscriptionMutation,
} = userApi;
