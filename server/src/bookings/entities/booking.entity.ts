import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';

// date/time se guardan como TEXT a propósito (no tipos temporales nativos de
// Postgres): en toda la app se tratan como tokens de negocio opacos
// (comparación de strings contra todayStr(), pertenencia a SLOTS), igual que
// en el esquema original — usar `date`/`time` nativos reintroduciría ambigüedad
// de zona horaria que este diseño evita deliberadamente.
@Entity('bookings')
@Unique('UQ_bookings_date_time', ['date', 'time'])
export class Booking {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  date: string;

  @Column({ type: 'text' })
  time: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text' })
  phone: string;

  @Column({ type: 'text' })
  service: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'mp_payment_id', type: 'text', nullable: true })
  mpPaymentId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
