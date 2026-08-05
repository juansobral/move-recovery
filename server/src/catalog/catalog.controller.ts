import { Controller, Get } from '@nestjs/common';
import { SERVICIOS, SLOTS } from './catalog.constants';

@Controller('config')
export class CatalogController {
  @Get()
  getConfig(): { slots: readonly string[]; servicios: readonly string[] } {
    return { slots: SLOTS, servicios: SERVICIOS };
  }
}
