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

  async tryConsumeCredit(userId: string): Promise<boolean> {
    const subscription = await this.findCurrent(userId);
    if (!subscription || subscription.sessionCreditsRemaining <= 0) return false;
    subscription.sessionCreditsRemaining -= 1;
    await this.subscriptionsRepo.save(subscription);
    return true;
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
}
