import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { CheckoutReferenceService } from './checkout-reference.service';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [BookingsModule, SubscriptionsModule, UsersModule],
  controllers: [PaymentsController],
  providers: [MercadoPagoService, CheckoutReferenceService],
})
export class PaymentsModule {}
