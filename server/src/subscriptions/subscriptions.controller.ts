import { Controller, Delete, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { UserJwtAuthGuard } from '../users/guards/user-jwt-auth.guard';
import { AuthenticatedCustomer } from '../users/users.types';
import { MercadoPagoService } from '../payments/mercadopago.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(UserJwtAuthGuard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  @Get('me')
  async me(@CurrentUser() customer: AuthenticatedCustomer) {
    const subscription = await this.subscriptionsService.findCurrent(customer.id);
    if (!subscription) return null;
    return {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      sessionCreditsRemaining: subscription.sessionCreditsRemaining,
      sessionCreditsTotal: subscription.sessionCreditsTotal,
    };
  }

  @Delete('me')
  async cancel(@CurrentUser() customer: AuthenticatedCustomer) {
    const subscription = await this.subscriptionsService.findCurrent(customer.id);
    if (!subscription) throw new NotFoundException('No tenés una suscripción activa.');

    try {
      await this.mercadoPago.cancelPreapproval(subscription.mpPreapprovalId);
    } catch (e) {
      // Seguimos igual: si ya estaba cancelada en MercadoPago (o hay un error de
      // red), no tiene sentido dejar al cliente sin forma de cancelar localmente
      // — lo que importa para el acceso es currentPeriodEnd/créditos, no este flag.
      console.error('[subscriptions] fallo al cancelar en MercadoPago:', (e as Error).message);
    }

    await this.subscriptionsService.markCancelled(customer.id);
    return { ok: true };
  }
}
