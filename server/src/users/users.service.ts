import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { todayStr } from '../common/date.util';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from './entities/user.entity';
import { GoogleProfile } from './google-token-verifier.service';

export interface GoogleLoginResult {
  accessToken: string;
  profileComplete: boolean;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isSocio: boolean;
  createdAt: Date;
  plan: 'standard' | 'premium' | null;
  planStatus: 'authorized' | 'cancelled' | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Subscription) private readonly subscriptionsRepo: Repository<Subscription>,
    private readonly jwt: JwtService,
  ) {}

  async loginWithGoogle(profile: GoogleProfile): Promise<GoogleLoginResult> {
    const user = await this.upsertFromGoogleProfile(profile);
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, typ: 'customer' });
    return { accessToken, profileComplete: user.phone !== null };
  }

  async upsertFromGoogleProfile(profile: GoogleProfile): Promise<User> {
    let user = await this.usersRepo.findOne({ where: { googleId: profile.googleId } });
    if (user) return user;

    // Puede que ya exista una cuenta con este email pero sin googleId
    // vinculado (no debería pasar en la práctica) — la vinculamos en vez de
    // crear una cuenta duplicada.
    user = await this.usersRepo.findOne({ where: { email: profile.email } });
    if (user) {
      user.googleId = profile.googleId;
      user.name = profile.name;
      user.avatarUrl = profile.avatarUrl;
      return this.usersRepo.save(user);
    }

    return this.usersRepo.save(
      this.usersRepo.create({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      }),
    );
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async completePhone(id: string, phone: string): Promise<User> {
    const user = await this.usersRepo.findOneOrFail({ where: { id } });
    user.phone = phone;
    return this.usersRepo.save(user);
  }

  async findAll(): Promise<AdminUserListItem[]> {
    const users = await this.usersRepo.find({ order: { createdAt: 'DESC' } });
    const subscriptions = await this.subscriptionsRepo.find({ order: { createdAt: 'DESC' } });

    // Igual que SubscriptionsService.findCurrent (fila más reciente con
    // currentPeriodEnd >= hoy) pero para todos los usuarios en una sola
    // consulta en vez de N+1 — subscriptions ya viene ordenado DESC, así que
    // la primera fila vista por usuario es la más reciente.
    const today = todayStr();
    const currentByUser = new Map<string, Subscription>();
    for (const sub of subscriptions) {
      if (sub.currentPeriodEnd < today) continue;
      if (!currentByUser.has(sub.userId)) currentByUser.set(sub.userId, sub);
    }

    return users.map((u) => {
      const current = currentByUser.get(u.id);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        isSocio: u.isSocio,
        createdAt: u.createdAt,
        plan: current?.plan ?? null,
        planStatus: current?.status ?? null,
      };
    });
  }

  async setSocio(id: string, isSocio: boolean): Promise<User> {
    const user = await this.usersRepo.findOneOrFail({ where: { id } });
    user.isSocio = isSocio;
    return this.usersRepo.save(user);
  }

  // UPDATE condicional atómico — mismo patrón que
  // SubscriptionsService.tryConsumeCredit: el "¿ya lo usó?" y el marcado
  // pasan en la misma sentencia, así dos reservas simultáneas del mismo
  // usuario no pueden consumir la sesión gratis dos veces.
  async tryRedeemFreeSession(userId: string): Promise<boolean> {
    const result = await this.usersRepo
      .createQueryBuilder()
      .update(User)
      .set({ freeSessionRedeemedAt: () => 'now()' })
      .where('id = :id AND free_session_redeemed_at IS NULL', { id: userId })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  // Compensación de tryRedeemFreeSession: si la reserva que iba a usar la
  // sesión gratis falla, la devolvemos.
  async restoreFreeSession(userId: string): Promise<void> {
    await this.usersRepo
      .createQueryBuilder()
      .update(User)
      .set({ freeSessionRedeemedAt: null })
      .where('id = :id', { id: userId })
      .execute();
  }
}
