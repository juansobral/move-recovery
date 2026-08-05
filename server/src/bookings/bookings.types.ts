export interface AvailabilitySlot {
  time: string;
  available: boolean;
}

export interface AvailabilityResponse {
  date: string;
  slots: AvailabilitySlot[];
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
