import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountCodesController } from './discount-codes.controller';
import { DiscountCodesService } from './discount-codes.service';
import { DiscountCodeSettings } from './entities/discount-code-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DiscountCodeSettings])],
  controllers: [DiscountCodesController],
  providers: [DiscountCodesService],
  exports: [DiscountCodesService],
})
export class DiscountCodesModule {}
