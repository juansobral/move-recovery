import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('pricing_settings')
export class PricingSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'standard_price_uyu', type: 'int' })
  standardPriceUyu: number;

  @Column({ name: 'standard_price_socio_uyu', type: 'int' })
  standardPriceSocioUyu: number;

  @Column({ name: 'premium_price_uyu', type: 'int' })
  premiumPriceUyu: number;

  @Column({ name: 'premium_price_socio_uyu', type: 'int' })
  premiumPriceSocioUyu: number;

  @Column({ name: 'reset_session_price_uyu', type: 'int' })
  resetSessionPriceUyu: number;

  @Column({ name: 'reset_session_price_socio_uyu', type: 'int' })
  resetSessionPriceSocioUyu: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
