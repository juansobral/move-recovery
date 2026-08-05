import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { PLANS, PlanKey } from '../catalog/catalog.constants';
import { todayStr } from '../common/date.util';
import { Subscription } from './entities/subscription.entity';

export interface CreateFromPreapprovalParams {
  userId: string;
  plan: PlanKey;
  mpPreapprovalId: string;
  periodStart: string;
  periodEnd: string;
}

@Injectable()
export class SubscriptionsService {
  constructor(@InjectRepository(Subscription) private readonly subscriptionsRepo: Repository<Subscription>) {}

  findCurrent(userId: string): Promise<Subscription | null> {
    return this.subscriptionsRepo.findOne({
      where: { userId, currentPeriodEnd: MoreThanOrEqual(todayStr()) },
      order: { createdAt: 'DESC' },
    });
  }

  // UPDATE condicional atómico: el "¿queda crédito?" y el descuento pasan en la
  // misma sentencia, así dos reservas simultáneas del mismo cliente no pueden
  // consumir el mismo crédito (el read-modify-write anterior sí lo permitía).
  async tryConsumeCredit(userId: string): Promise<boolean> {
    const subscription = await this.findCurrent(userId);
    if (!subscription) return false;
    const result = await this.subscriptionsRepo
      .createQueryBuilder()
      .update(Subscription)
      .set({ sessionCreditsRemaining: () => 'session_credits_remaining - 1' })
      .where('id = :id AND session_credits_remaining > 0', { id: subscription.id })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  // Compensación de tryConsumeCredit: si la reserva que iba a pagar el crédito
  // falla, lo devolvemos (nunca por encima del total del plan).
  async restoreCredit(userId: string): Promise<void> {
    const subscription = await this.findCurrent(userId);
    if (!subscription) return;
    await this.subscriptionsRepo
      .createQueryBuilder()
      .update(Subscription)
      .set({ sessionCreditsRemaining: () => 'LEAST(session_credits_remaining + 1, session_credits_total)' })
      .where('id = :id', { id: subscription.id })
      .execute();
  }

  async createFromPreapproval(params: CreateFromPreapprovalParams): Promise<Subscription> {
    const total = PLANS[params.plan].sessionsPerMonth;
    return this.subscriptionsRepo.save(
      this.subscriptionsRepo.create({
        userId: params.userId,
        plan: params.plan,
        mpPreapprovalId: params.mpPreapprovalId,
        status: 'authorized',
        currentPeriodStart: params.periodStart,
        currentPeriodEnd: params.periodEnd,
        sessionCreditsTotal: total,
        sessionCreditsRemaining: total,
      }),
    );
  }

  // Se llama cuando llega el webhook de un cobro recurrente (renovación).
  async renewPeriod(mpPreapprovalId: string, periodStart: string, periodEnd: string): Promise<Subscription | null> {
    const subscription = await this.subscriptionsRepo.findOne({ where: { mpPreapprovalId }, order: { createdAt: 'DESC' } });
    if (!subscription) return null;
    subscription.currentPeriodStart = periodStart;
    subscription.currentPeriodEnd = periodEnd;
    subscription.sessionCreditsRemaining = subscription.sessionCreditsTotal;
    return this.subscriptionsRepo.save(subscription);
  }

  async markCancelled(userId: string): Promise<Subscription | null> {
    const subscription = await this.findCurrent(userId);
    if (!subscription) return null;
    subscription.status = 'cancelled';
    return this.subscriptionsRepo.save(subscription);
  }

  findByPreapprovalId(mpPreapprovalId: string): Promise<Subscription | null> {
    return this.subscriptionsRepo.findOne({ where: { mpPreapprovalId } });
  }
}
