import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from './auth/entities/admin-user.entity';
import { AuthModule } from './auth/auth.module';
import { Booking } from './bookings/entities/booking.entity';
import { BookingsModule } from './bookings/bookings.module';
import { CatalogModule } from './catalog/catalog.module';
import { DiagModule } from './diag/diag.module';
import { CheckoutIntent } from './payments/entities/checkout-intent.entity';
import { PaymentsModule } from './payments/payments.module';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { User } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Un solo .env en la raíz del repo — en Vercel esto no importa (las env
    // vars ya están inyectadas en process.env), es solo para dev local.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: __dirname + '/../../.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [AdminUser, Booking, User, Subscription, CheckoutIntent],
        migrations: [__dirname + '/migrations/*.js'],
        migrationsRun: false,
        synchronize: false,
        // Un pool chico: cada instancia de la función serverless atiende
        // ~1 request concurrente, un pool grande por instancia fría desperdicia
        // conexiones contra el límite de Neon.
        extra: { max: 3 },
      }),
    }),
    AuthModule,
    CatalogModule,
    BookingsModule,
    DiagModule,
    UsersModule,
    SubscriptionsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
