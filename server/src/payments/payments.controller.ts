import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PLANS, RESET_SESSION_PRICE } from '../catalog/catalog.constants';
import { BookingsService } from '../bookings/bookings.service';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { UserJwtAuthGuard } from '../users/guards/user-jwt-auth.guard';
import { AuthenticatedCustomer } from '../users/users.types';
import { UsersService } from '../users/users.service';
import { CheckoutReferenceService } from './checkout-reference.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { MercadoPagoService } from './mercadopago.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller()
@UseGuards(UserJwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usersService: UsersService,
    private readonly checkoutReference: CheckoutReferenceService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  @Post('bookings/checkout')
  async checkoutBooking(@Body() dto: CreateCheckoutDto, @CurrentUser() customer: AuthenticatedCustomer) {
    const hasCredit = await this.subscriptionsService.tryConsumeCredit(customer.id);
    if (hasCredit) {
      return this.bookingsService.create(dto, customer.id);
    }

    const user = await this.usersService.findById(customer.id);
    const amount = user?.isSocio ? RESET_SESSION_PRICE.priceSocioUyu : RESET_SESSION_PRICE.priceUyu;
    const siteUrl = process.env.SITE_URL ?? 'http://localhost:5173';

    const reference = this.checkoutReference.sign({
      kind: 'oneoff',
      userId: customer.id,
      date: dto.date,
      time: dto.time,
      service: dto.service,
      notes: dto.notes?.slice(0, 200),
    });

    const { initPoint } = await this.mercadoPago.createPreference({
      title: 'Recovery Room — Reset Session',
      amount,
      externalReference: reference,
      successUrl: `${siteUrl}/pago-pendiente?ref=${encodeURIComponent(reference)}`,
      failureUrl: `${siteUrl}/pago-pendiente?ref=${encodeURIComponent(reference)}&failed=1`,
      pendingUrl: `${siteUrl}/pago-pendiente?ref=${encodeURIComponent(reference)}`,
    });

    return { requiresPayment: true, initPoint, reference };
  }

  @Post('subscriptions/checkout')
  async checkoutSubscription(@Body() dto: CreateSubscriptionCheckoutDto, @CurrentUser() customer: AuthenticatedCustomer) {
    const user = await this.usersService.findById(customer.id);
    const plan = PLANS[dto.plan];
    const amount = user?.isSocio ? plan.priceSocioUyu : plan.priceUyu;
    const siteUrl = process.env.SITE_URL ?? 'http://localhost:5173';

    const reference = this.checkoutReference.sign({
      kind: 'subscription',
      userId: customer.id,
      plan: dto.plan,
      intendedBooking: dto.intendedBooking
        ? { ...dto.intendedBooking, notes: dto.intendedBooking.notes?.slice(0, 200) }
        : undefined,
    });

    const { initPoint } = await this.mercadoPago.createPreapproval({
      reason: plan.label,
      amount,
      payerEmail: user!.email,
      externalReference: reference,
      backUrl: `${siteUrl}/pago-pendiente?ref=${encodeURIComponent(reference)}`,
    });

    return { initPoint, reference };
  }
}
