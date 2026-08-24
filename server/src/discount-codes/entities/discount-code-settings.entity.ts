import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('discount_code_settings')
export class DiscountCodeSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'boolean', default: false })
  active: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
