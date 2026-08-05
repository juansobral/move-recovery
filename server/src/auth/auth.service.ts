import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { AdminUser } from './entities/admin-user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser) private readonly adminRepo: Repository<AdminUser>,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const admin = await this.adminRepo.findOne({ where: { email: dto.email.trim().toLowerCase() } });
    const ok = admin ? await bcrypt.compare(dto.password, admin.passwordHash) : false;

    // Un único error genérico: nunca distinguir "no existe" de "clave incorrecta".
    if (!admin || !ok) throw new UnauthorizedException('Credenciales inválidas.');

    const accessToken = await this.jwt.signAsync({ sub: admin.id, email: admin.email, typ: 'admin' });
    return { accessToken };
  }
}
