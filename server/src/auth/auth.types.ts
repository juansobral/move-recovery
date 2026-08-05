export interface JwtPayload {
  sub: string;
  email: string;
  typ: 'admin';
}

export interface AuthenticatedAdmin {
  id: string;
  email: string;
}
