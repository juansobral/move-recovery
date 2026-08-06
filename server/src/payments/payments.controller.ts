import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
import { MercadoPagoService, MpPayment } from './mercadopago.service';
import { verifyWebhookSignature } from './webhook-signature.util';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { addMonths, todayStr } from '../common/date.util';

@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

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
      try {
        return await this.bookingsService.create(dto, customer.id);
      } catch (e) {
        // Si la reserva falla (bloque tomado, perfil incompleto) el crédito ya
        // estaba descontado — lo devolvemos para no cobrarle una sesión que no fue.
        await this.subscriptionsService.restoreCredit(customer.id);
        throw e;
      }
    }

    const user = await this.usersService.findById(customer.id);
    const amount = user?.isSocio ? RESET_SESSION_PRICE.priceSocioUyu : RESET_SESSION_PRICE.priceUyu;
    const siteUrl = this.config.get<string>('SITE_URL') ?? 'http://localhost:5173';

    const reference = await this.checkoutReference.sign({
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
    const existing = await this.subscriptionsService.findCurrent(customer.id);
    if (existing && existing.status === 'authorized') {
      throw new ConflictException('Ya tenés una suscripción activa.');
    }

    const user = await this.usersService.findById(customer.id);
    const plan = PLANS[dto.plan];
    const amount = user?.isSocio ? plan.priceSocioUyu : plan.priceUyu;
    const siteUrl = this.config.get<string>('SITE_URL') ?? 'http://localhost:5173';

    const reference = await this.checkoutReference.sign({
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

  @Get('bookings/checkout-status')
  @UseGuards(UserJwtAuthGuard)
  async checkoutStatus(@Query('ref') ref: string, @CurrentUser() customer: AuthenticatedCustomer) {
    if (!ref) return { status: 'invalid' };
    const intent = await this.checkoutReference.verify(ref);
    if (!intent || intent.userId !== customer.id) {
      return { status: 'invalid' };
    }

    if (intent.kind === 'oneoff') {
      const booking = await this.bookingsService.findByUserAndSlot(customer.id, intent.date, intent.time);
      return booking ? { status: 'completed', booking } : { status: 'pending' };
    }

    let subscription = await this.subscriptionsService.findCurrent(customer.id);
    if (!subscription) {
      // El webhook de "preapproval" puede no llegar nunca en sandbox con
      // usuarios de prueba, aún con el evento de Suscripciones tildado —
      // antes de resignarnos a "pending", le preguntamos directo a
      // MercadoPago si ya la autorizó.
      await this.reconcilePreapproval(ref, customer.email);
      subscription = await this.subscriptionsService.findCurrent(customer.id);
    }
    if (!subscription) return { status: 'pending' };

    if (!intent.intendedBooking) return { status: 'completed', booking: null };

    const booking = await this.bookingsService.findByUserAndSlot(customer.id, intent.intendedBooking.date, intent.intendedBooking.time);
    return { status: 'completed', booking: booking ?? null };
  }

  @Post('payments/webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Query('type') type: string,
    @Query('data.id') dataId: string,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (!secret) throw new Error('Falta MP_WEBHOOK_SECRET.');

    this.logger.log(
      `Webhook recibido: type=${type} dataId=${dataId ?? ''} xSignature=${xSignature ?? ''} xRequestId=${xRequestId ?? ''} ` +
        `body.action=${body?.action ?? ''} body.liveMode=${body?.live_mode ?? ''} body.userId=${body?.user_id ?? ''}`,
    );

    const validSignature = verifyWebhookSignature({ xSignature: xSignature ?? '', xRequestId: xRequestId ?? '', dataId: dataId ?? '', secret });
    if (!validSignature) {
      this.logger.warn(`Firma de webhook inválida: type=${type} dataId=${dataId ?? ''} (ver detalle en [mp-webhook] arriba)`);
      throw new UnauthorizedException('Firma inválida.');
    }

    if (type === 'payment') {
      await this.handlePaymentWebhook(dataId);
    } else if (type === 'merchant_order' || type === 'topic_merchant_order_wh') {
      await this.handleMerchantOrderWebhook(dataId);
    } else if (type === 'preapproval' || type === 'subscription_preapproval') {
      await this.handlePreapprovalWebhook(dataId);
    } else if (type === 'subscription_authorized_payment') {
      await this.handleAuthorizedPaymentWebhook(dataId);
    }
    // Cualquier otro topic (o uno que no reconocemos) se ignora silenciosamente
    // — MercadoPago espera un 200 igual, para no reintentar innecesariamente.

    return { received: true };
  }

  private async handlePaymentWebhook(paymentId: string): Promise<void> {
    let payment: MpPayment;
    try {
      payment = await this.mercadoPago.getPayment(paymentId);
    } catch (e) {
      // Pasa, por ejemplo, cuando el pago es de una cuenta/ambiente distinto al
      // del MP_ACCESS_TOKEN configurado (ej. live_mode real contra credenciales
      // de prueba) — la API de MercadoPago devuelve 404/401 y antes esto se
      // caía como un 500 sin ninguna pista de la causa.
      this.logger.error(`No se pudo obtener el pago ${paymentId} desde MercadoPago: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
    await this.processApprovedPayment(payment);
  }

  // En sandbox con usuarios de prueba, Checkout Pro a veces nunca manda el
  // webhook de topic "payment" — solo el de "merchant_order" — así que hay que
  // ir a buscar los pagos de la orden a mano y procesarlos igual.
  private async handleMerchantOrderWebhook(merchantOrderId: string): Promise<void> {
    let order: { externalReference: string | null; payments: MpPayment[] };
    try {
      order = await this.mercadoPago.getMerchantOrder(merchantOrderId);
    } catch (e) {
      this.logger.error(`No se pudo obtener la orden ${merchantOrderId} desde MercadoPago: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
    this.logger.log(
      `Orden ${merchantOrderId}: externalReference=${order.externalReference ?? 'null'} pagos=[${order.payments.map((p) => `${p.id}:${p.status}`).join(', ')}]`,
    );
    for (const payment of order.payments) {
      await this.processApprovedPayment(payment);
    }
  }

  private async processApprovedPayment(payment: MpPayment): Promise<void> {
    this.logger.log(`Pago ${payment.id}: status=${payment.status} externalReference=${payment.externalReference ?? 'null'}`);
    if (payment.status !== 'approved' || !payment.externalReference) return;

    // MercadoPago reintenta las notificaciones (y manda payment.created y
    // payment.updated por el mismo pago): si ya reservamos con este pago, salimos.
    // Sin esto, la segunda entrega chocaba contra UNIQUE(date, time) y terminaba
    // reembolsando una reserva legítima ya confirmada.
    const alreadyProcessed = await this.bookingsService.findByMpPaymentId(String(payment.id));
    if (alreadyProcessed) {
      this.logger.log(`Pago ${payment.id} ya procesado (reserva ${alreadyProcessed.id}) — se ignora reintento.`);
      return;
    }

    const intent = await this.checkoutReference.verify(payment.externalReference);
    if (!intent || intent.kind !== 'oneoff') {
      this.logger.warn(
        `Pago ${payment.id}: referencia ${payment.externalReference} sin intent "oneoff" válido (encontrado=${intent ? intent.kind : 'null'}).`,
      );
      return;
    }

    try {
      const booking = await this.bookingsService.create(
        { date: intent.date, time: intent.time, service: intent.service, notes: intent.notes },
        intent.userId,
        String(payment.id),
      );
      this.logger.log(`Pago ${payment.id}: reserva ${booking.id} creada (${intent.date} ${intent.time}).`);
    } catch (e) {
      if (e instanceof ConflictException || e instanceof BadRequestException) {
        // Falla permanente: el bloque ya no está disponible (ConflictException)
        // o el intent quedó inválido (ej. fecha pasada, perfil incompleto) —
        // en ningún caso un reintento de MercadoPago va a lograr crear la
        // reserva, así que reembolsamos en vez de dejar cobrado sin turno.
        try {
          await this.mercadoPago.refundPayment(String(payment.id));
        } catch (refundError) {
          // El pago quedó cobrado sin reserva y el reembolso automático
          // también falló (ej. la cuenta de prueba de MercadoPago no puede
          // reembolsar vía API) — no relanzamos: reintentar el webhook no va
          // a lograr ni crear la reserva ni reembolsar solo, y antes esto
          // tumbaba el webhook entero con un 500. Queda logueado para
          // reembolsar a mano desde el dashboard de MercadoPago.
          this.logger.error(
            `Reembolso automático falló para el pago ${payment.id} (reserva rechazada: ${e.message}): ${refundError instanceof Error ? refundError.message : refundError}`,
          );
        }
      } else {
        throw e; // error transitorio (ej. DB caída) — dejamos que MercadoPago reintente el webhook
      }
    }
  }

  // subscription_preapproval/preapproval avisan del ciclo de vida de la
  // suscripción (alta, cambios, baja) — NO de cada cobro mensual. Por eso este
  // handler solo crea la suscripción y es idempotente: renovar acá extendía el
  // período gratis en cada reintento de MercadoPago.
  private async handlePreapprovalWebhook(preapprovalId: string): Promise<void> {
    const data = await this.mercadoPago.getPreapproval(preapprovalId);
    this.logger.log(`Preapproval ${preapprovalId}: status=${data.status} externalReference=${data.externalReference ?? 'null'}`);
    await this.processAuthorizedPreapproval(preapprovalId, data.status, data.externalReference);
  }

  // Fallback llamado desde checkoutStatus cuando el webhook de preapproval
  // nunca llegó — consulta MercadoPago directo por la referencia y procesa la
  // suscripción con la misma lógica que usaría el webhook si hubiera llegado.
  private async reconcilePreapproval(reference: string, payerEmail: string): Promise<void> {
    try {
      const found = await this.mercadoPago.searchPreapprovalByReference(payerEmail, reference);
      if (!found) return;
      this.logger.log(`Reconciliación manual: preapproval ${found.id} (ref ${reference}) status=${found.status}`);
      await this.processAuthorizedPreapproval(found.id, found.status, reference);
    } catch (e) {
      this.logger.error(`Falló la reconciliación manual de preapproval para ref ${reference}: ${e instanceof Error ? e.message : e}`);
    }
  }

  private async processAuthorizedPreapproval(preapprovalId: string, status: string, externalReference: string | null): Promise<void> {
    if (status !== 'authorized' || !externalReference) return;

    const existing = await this.subscriptionsService.findByPreapprovalId(preapprovalId);
    if (existing) return; // ya existe — la creación es idempotente, la renovación va por otro topic

    const intent = await this.checkoutReference.verify(externalReference);
    if (!intent || intent.kind !== 'subscription') return;

    const periodStart = todayStr();
    const periodEnd = addMonths(periodStart, 1);
    await this.subscriptionsService.createFromPreapproval({
      userId: intent.userId,
      plan: intent.plan,
      mpPreapprovalId: preapprovalId,
      periodStart,
      periodEnd,
    });

    if (intent.intendedBooking) {
      const hasCredit = await this.subscriptionsService.tryConsumeCredit(intent.userId);
      if (hasCredit) {
        try {
          await this.bookingsService.create(
            {
              date: intent.intendedBooking.date,
              time: intent.intendedBooking.time,
              service: intent.intendedBooking.service,
              notes: intent.intendedBooking.notes,
            },
            intent.userId,
          );
        } catch {
          await this.subscriptionsService.restoreCredit(intent.userId);
          // El horario ya no está disponible — el crédito queda disponible para
          // que el cliente elija otro.
        }
      }
    }
  }

  // Este SÍ es el topic del cobro recurrente mensual de una suscripción.
  private async handleAuthorizedPaymentWebhook(authorizedPaymentId: string): Promise<void> {
    const data = await this.mercadoPago.getAuthorizedPayment(authorizedPaymentId);
    // OJO (Task 20): 'processed' es el string de éxito que asumimos para este
    // recurso — MercadoPago no lo documenta con precisión. Hay que confirmarlo
    // contra un cobro real en sandbox antes de confiar en esta rama.
    if (data.status !== 'processed' || !data.preapprovalId) return;

    const periodStart = todayStr();
    const periodEnd = addMonths(periodStart, 1);
    await this.subscriptionsService.renewPeriod(data.preapprovalId, periodStart, periodEnd);
  }
}
