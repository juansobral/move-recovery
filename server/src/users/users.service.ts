import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { GoogleProfile } from './google-token-verifier.service';

export interface GoogleLoginResult {
  accessToken: string;
  profileComplete: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
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

  findAll(): Promise<User[]> {
    return this.usersRepo.find({ order: { createdAt: 'DESC' } });
  }

  async setSocio(id: string, isSocio: boolean): Promise<User> {
    const user = await this.usersRepo.findOneOrFail({ where: { id } });
    user.isSocio = isSocio;
    return this.usersRepo.save(user);
  }
}
