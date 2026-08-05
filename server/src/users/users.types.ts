export interface UserJwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedCustomer {
  id: string;
  email: string;
}
