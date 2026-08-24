import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../bookings/bookings.module';
import { DiscountCodesModule } from '../discount-codes/discount-codes.module';
import { PricingModule } from '../pricing/pricing.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { CheckoutReferenceService } from './checkout-reference.service';
import { CheckoutIntent } from './entities/checkout-intent.entity';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CheckoutIntent]), BookingsModule, SubscriptionsModule, UsersModule, PricingModule, DiscountCodesModule],
  controllers: [PaymentsController],
  providers: [MercadoPagoService, CheckoutReferenceService],
})
export class PaymentsModule {}
