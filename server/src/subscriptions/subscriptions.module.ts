import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { MercadoPagoService } from '../payments/mercadopago.service';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, User]), UsersModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, MercadoPagoService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
