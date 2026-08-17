import { Controller, Get } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import { SERVICIOS, SLOTS } from './catalog.constants';

interface ConfigResponse {
  slots: readonly string[];
  servicios: readonly string[];
  pricing: {
    standardPriceUyu: number;
    standardPriceSocioUyu: number;
    premiumPriceUyu: number;
    premiumPriceSocioUyu: number;
    resetSessionPriceUyu: number;
    resetSessionPriceSocioUyu: number;
    firstSessionPriceUyu: number;
  };
}

@Controller('config')
export class CatalogController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  async getConfig(): Promise<ConfigResponse> {
    const pricing = await this.pricingService.getCurrent();
    return {
      slots: SLOTS,
      servicios: SERVICIOS,
      pricing: {
        standardPriceUyu: pricing.standardPriceUyu,
        standardPriceSocioUyu: pricing.standardPriceSocioUyu,
        premiumPriceUyu: pricing.premiumPriceUyu,
        premiumPriceSocioUyu: pricing.premiumPriceSocioUyu,
        resetSessionPriceUyu: pricing.resetSessionPriceUyu,
        resetSessionPriceSocioUyu: pricing.resetSessionPriceSocioUyu,
        firstSessionPriceUyu: pricing.firstSessionPriceUyu,
      },
    };
  }
}
