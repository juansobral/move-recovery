import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiagService } from './diag.service';
import { DiagResponse } from './diag.types';

@Controller('diag')
@UseGuards(JwtAuthGuard)
export class DiagController {
  constructor(private readonly diagService: DiagService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  run(@Query('test') test?: string): Promise<DiagResponse> {
    return this.diagService.run(test);
  }
}
