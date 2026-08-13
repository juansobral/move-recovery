import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { PricingSettings } from './entities/pricing-settings.entity';
import { PricingService } from './pricing.service';

@Controller('admin/pricing')
@UseGuards(JwtAuthGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  getCurrent(): Promise<PricingSettings> {
    return this.pricingService.getCurrent();
  }

  @Put()
  update(@Body() dto: UpdatePricingDto): Promise<PricingSettings> {
    return this.pricingService.update(dto);
  }
}
