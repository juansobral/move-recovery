import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface OneOffBookingIntent {
  kind: 'oneoff';
  userId: string;
  date: string;
  time: string;
  service?: string;
  notes?: string;
}

export interface SubscriptionIntent {
  kind: 'subscription';
  userId: string;
  plan: 'standard' | 'premium';
  intendedBooking?: { date: string; time: string; service?: string; notes?: string };
}

export type CheckoutIntent = OneOffBookingIntent | SubscriptionIntent;

@Injectable()
export class CheckoutReferenceService {
  constructor(private readonly config: ConfigService) {}

  private get secret(): string {
    const s = this.config.get<string>('CHECKOUT_REFERENCE_SECRET');
    if (!s) throw new Error('Falta CHECKOUT_REFERENCE_SECRET.');
    return s;
  }

  sign(intent: CheckoutIntent): string {
    const payload = Buffer.from(JSON.stringify(intent)).toString('base64url');
    const signature = createHmac('sha256', this.secret).update(payload).digest('hex');
    return `${payload}.${signature}`;
  }

  verify(reference: string): CheckoutIntent | null {
    const [payload, signature] = reference.split('.');
    if (!payload || !signature) return null;

    const expected = createHmac('sha256', this.secret).update(payload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) return null;

    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as CheckoutIntent;
    } catch {
      return null;
    }
  }
}
