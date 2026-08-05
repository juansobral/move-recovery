export interface Subscription {
  plan: 'standard' | 'premium';
  status: 'authorized' | 'cancelled';
  currentPeriodEnd: string;
  sessionCreditsRemaining: number;
  sessionCreditsTotal: number;
}

export interface CheckoutResult {
  id?: number;
  date?: string;
  time?: string;
  service?: string;
  emailSent?: boolean;
  requiresPayment?: boolean;
  initPoint?: string;
  reference?: string;
}

export interface CheckoutStatus {
  status: 'completed' | 'pending' | 'invalid';
  booking?: unknown;
}
