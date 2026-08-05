import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '../../lib/axiosBaseQuery';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Booking', 'AdminUser'],
  endpoints: () => ({}),
});
