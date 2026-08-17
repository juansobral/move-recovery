export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  isSocio: boolean;
  hasPaidOneOffBooking: boolean;
}

export interface GoogleLoginResponse {
  accessToken: string;
  profileComplete: boolean;
}
