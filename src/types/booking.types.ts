export interface Booking {
  id: number;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  notes: string | null;
  mpPaymentId: string | null;
  createdAt: string;
}

export interface PricingConfig {
  standardPriceUyu: number;
  standardPriceSocioUyu: number;
  premiumPriceUyu: number;
  premiumPriceSocioUyu: number;
  resetSessionPriceUyu: number;
  resetSessionPriceSocioUyu: number;
  firstSessionPriceUyu: number;
}

export interface BookingConfig {
  slots: string[];
  servicios: string[];
  pricing: PricingConfig;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
}

export interface AvailabilityResponse {
  date: string;
  slots: AvailabilitySlot[];
}

export interface CreateBookingRequest {
  date: string;
  time: string;
  service: string;
  notes?: string;
}

export interface CreateBookingResponse {
  id: number;
  date: string;
  time: string;
  service: string;
  emailSent: boolean;
}

export interface CancelBookingResponse {
  ok: true;
  id: number;
  notified: boolean;
}
