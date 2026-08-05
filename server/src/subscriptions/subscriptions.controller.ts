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
      currentPeriodEnd: subscription.currentPeriodEnd,
      sessionCreditsRemaining: subscription.sessionCreditsRemaining,
      sessionCreditsTotal: subscription.sessionCreditsTotal,
    };
  }

  @Delete('me')
  async cancel(@CurrentUser() customer: AuthenticatedCustomer) {
    const subscription = await this.subscriptionsService.findCurrent(customer.id);
    if (!subscription) throw new NotFoundException('No tenés una suscripción activa.');
    await this.mercadoPago.cancelPreapproval(subscription.mpPreapprovalId);
    await this.subscriptionsService.markCancelled(customer.id);
    return { ok: true };
  }
}
