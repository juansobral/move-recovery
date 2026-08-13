import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanKey } from '../catalog/catalog.constants';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { PricingSettings } from './entities/pricing-settings.entity';

@Injectable()
export class PricingService {
  constructor(@InjectRepository(PricingSettings) private readonly pricingRepo: Repository<PricingSettings>) {}

  async getCurrent(): Promise<PricingSettings> {
    const [current] = await this.pricingRepo.find({ take: 1 });
    // No debería pasar post-migración — si pasa, la migración no corrió y hay
    // que enterarse fuerte, no devolver precios inventados en silencio.
    if (!current) throw new InternalServerErrorException('No hay precios configurados.');
    return current;
  }

  async update(dto: UpdatePricingDto): Promise<PricingSettings> {
    const current = await this.getCurrent();
    Object.assign(current, dto);
    return this.pricingRepo.save(current);
  }

  async getPlanPrice(plan: PlanKey, isSocio: boolean): Promise<number> {
    const pricing = await this.getCurrent();
    if (plan === 'standard') return isSocio ? pricing.standardPriceSocioUyu : pricing.standardPriceUyu;
    return isSocio ? pricing.premiumPriceSocioUyu : pricing.premiumPriceUyu;
  }

  async getResetSessionPrice(isSocio: boolean): Promise<number> {
    const pricing = await this.getCurrent();
    return isSocio ? pricing.resetSessionPriceSocioUyu : pricing.resetSessionPriceUyu;
  }
}
