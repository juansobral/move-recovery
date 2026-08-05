import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { CheckoutIntentPayload } from '../checkout-reference.service';

@Entity('checkout_intents')
export class CheckoutIntent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Guarda el intent completo (oneoff o subscription) — el id de esta fila ES
  // la referencia que viaja por MercadoPago (64 caracteres máx, solo alfanumérico
  // + guiones — un UUID entra cómodo y no es adivinable, no hace falta firmarlo
  // aparte).
  @Column({ type: 'jsonb' })
  payload: CheckoutIntentPayload;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
