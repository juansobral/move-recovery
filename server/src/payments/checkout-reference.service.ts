import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckoutIntent } from './entities/checkout-intent.entity';

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

export type CheckoutIntentPayload = OneOffBookingIntent | SubscriptionIntent;

// `external_reference` de MercadoPago admite 64 caracteres como máximo, solo
// letras/dígitos/guiones/guiones bajos — un payload JSON firmado no entra ni
// cerca. Por eso el intent se persiste acá y lo que viaja por MercadoPago es el
// UUID de la fila: 36 caracteres, charset válido, e imposible de adivinar (esa
// imposibilidad es la "firma": si la fila no existe, la referencia no vale).
@Injectable()
export class CheckoutReferenceService {
  constructor(@InjectRepository(CheckoutIntent) private readonly repo: Repository<CheckoutIntent>) {}

  async sign(intent: CheckoutIntentPayload): Promise<string> {
    const row = await this.repo.save(this.repo.create({ userId: intent.userId, payload: intent }));
    return row.id;
  }

  async verify(reference: string): Promise<CheckoutIntentPayload | null> {
    if (!reference) return null;
    const row = await this.repo.findOne({ where: { id: reference } });
    return row ? row.payload : null;
  }
}
