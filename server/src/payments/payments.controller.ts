import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { verifyWebhookSignature } from './webhook-signature.util';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller()
export class PaymentsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usersService: UsersService,
    private readonly checkoutReference: CheckoutReferenceService,
    private readonly mercadoPago: MercadoPagoService,
    private readonly config: ConfigService,
  ) {}

  @Post('bookings/checkout')
  @UseGuards(UserJwtAuthGuard)
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
  @UseGuards(UserJwtAuthGuard)
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

  @Post('payments/webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Query('type') type: string,
    @Query('data.id') dataId: string,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
  ) {
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (!secret) throw new Error('Falta MP_WEBHOOK_SECRET.');

    const validSignature = verifyWebhookSignature({ xSignature: xSignature ?? '', xRequestId: xRequestId ?? '', dataId: dataId ?? '', secret });
    if (!validSignature) throw new UnauthorizedException('Firma inválida.');

    if (type === 'payment') {
      await this.handlePaymentWebhook(dataId);
    } else if (type === 'preapproval' || type === 'subscription_preapproval') {
      await this.handlePreapprovalWebhook(dataId);
    }
    // Cualquier otro topic (o uno que no reconocemos) se ignora silenciosamente
    // — MercadoPago espera un 200 igual, para no reintentar innecesariamente.

    return { received: true };
  }

  private async handlePaymentWebhook(paymentId: string): Promise<void> {
    const payment = await this.mercadoPago.getPayment(paymentId);
    if (payment.status !== 'approved' || !payment.externalReference) return;

    const intent = this.checkoutReference.verify(payment.externalReference);
    if (!intent || intent.kind !== 'oneoff') return;

    try {
      await this.bookingsService.create(
        { date: intent.date, time: intent.time, service: intent.service, notes: intent.notes },
        intent.userId,
        String(payment.id),
      );
    } catch {
      // El bloque ya no está disponible (alguien más lo tomó mientras se
      // procesaba el pago) — reembolsamos en vez de dejar cobrado sin turno.
      await this.mercadoPago.refundPayment(String(payment.id));
    }
  }

  private async handlePreapprovalWebhook(_preapprovalId: string): Promise<void> {
    // Implementado en la próxima tarea.
  }
}
