export interface UserJwtPayload {
  sub: string;
  email: string;
  typ: 'customer';
}

export interface AuthenticatedCustomer {
  id: string;
  email: string;
}
