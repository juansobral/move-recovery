export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedAdmin {
  id: string;
  email: string;
}
