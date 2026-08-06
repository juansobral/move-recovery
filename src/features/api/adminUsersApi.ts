import { baseApi } from './baseApi';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isSocio: boolean;
  createdAt: string;
  plan: 'standard' | 'premium' | null;
  planStatus: 'authorized' | 'cancelled' | null;
}

export const adminUsersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminUsers: builder.query<AdminUser[], void>({
      query: () => ({ url: '/admin/users', method: 'GET' }),
      providesTags: ['AdminUser'],
    }),
    setUserSocio: builder.mutation<AdminUser, { id: string; isSocio: boolean }>({
      query: ({ id, isSocio }) => ({ url: `/admin/users/${id}`, method: 'PATCH', data: { isSocio } }),
      invalidatesTags: ['AdminUser'],
    }),
  }),
});

export const { useGetAdminUsersQuery, useSetUserSocioMutation } = adminUsersApi;
