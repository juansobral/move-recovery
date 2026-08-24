import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateDiscountCodeDto } from './dto/update-discount-code.dto';
import { DiscountCodeSettings } from './entities/discount-code-settings.entity';

@Injectable()
export class DiscountCodesService {
  constructor(@InjectRepository(DiscountCodeSettings) private readonly repo: Repository<DiscountCodeSettings>) {}

  async getCurrent(): Promise<DiscountCodeSettings> {
    const [current] = await this.repo.find({ take: 1 });
    // No debería pasar post-migración — si pasa, la migración no corrió.
    if (!current) throw new InternalServerErrorException('No hay código de descuento configurado.');
    return current;
  }

  async update(dto: UpdateDiscountCodeDto): Promise<DiscountCodeSettings> {
    const current = await this.getCurrent();
    Object.assign(current, dto);
    return this.repo.save(current);
  }

  async isCodeValid(submitted: string): Promise<boolean> {
    const current = await this.getCurrent();
    const stored = current.code.trim();
    if (!current.active || !stored) return false;
    return submitted.trim().toLowerCase() === stored.toLowerCase();
  }
}
