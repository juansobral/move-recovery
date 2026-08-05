export interface Booking {
  id: number;
  date: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  notes: string | null;
  createdAt: string;
}

export interface BookingConfig {
  slots: string[];
  servicios: string[];
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
  name: string;
  email: string;
  phone: string;
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
