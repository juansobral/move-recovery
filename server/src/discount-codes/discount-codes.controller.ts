import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiscountCodesService } from './discount-codes.service';
import { UpdateDiscountCodeDto } from './dto/update-discount-code.dto';
import { DiscountCodeSettings } from './entities/discount-code-settings.entity';

@Controller('admin/discount-code')
@UseGuards(JwtAuthGuard)
export class DiscountCodesController {
  constructor(private readonly discountCodesService: DiscountCodesService) {}

  @Get()
  getCurrent(): Promise<DiscountCodeSettings> {
    return this.discountCodesService.getCurrent();
  }

  @Put()
  update(@Body() dto: UpdateDiscountCodeDto): Promise<DiscountCodeSettings> {
    return this.discountCodesService.update(dto);
  }
}
