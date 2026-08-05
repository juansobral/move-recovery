import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  plan: 'standard' | 'premium';

  @Column({ name: 'mp_preapproval_id', type: 'text', unique: true })
  mpPreapprovalId: string;

  // Estado de facturación en MercadoPago — NO es el chequeo de acceso (ver
  // SubscriptionsService.hasUsableCredits): una suscripción 'cancelled' sigue
  // siendo válida hasta currentPeriodEnd, a propósito.
  @Column({ type: 'text' })
  status: 'authorized' | 'cancelled';

  // TEXT a propósito, igual que Booking.date/time — se comparan como strings
  // AAAA-MM-DD, evita la ambigüedad de zona horaria de los tipos date/timestamp
  // nativos de Postgres.
  @Column({ name: 'current_period_start', type: 'text' })
  currentPeriodStart: string;

  @Column({ name: 'current_period_end', type: 'text' })
  currentPeriodEnd: string;

  @Column({ name: 'session_credits_remaining', type: 'int' })
  sessionCreditsRemaining: number;

  @Column({ name: 'session_credits_total', type: 'int' })
  sessionCreditsTotal: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
