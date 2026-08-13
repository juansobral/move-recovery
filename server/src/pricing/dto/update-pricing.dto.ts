import { IsInt, Min } from 'class-validator';

export class UpdatePricingDto {
  @IsInt({ message: 'El precio debe ser un número entero.' })
  @Min(1, { message: 'El precio debe ser mayor a 0.' })
  standardPriceUyu: number;

  @IsInt({ message: 'El precio debe ser un número entero.' })
  @Min(1, { message: 'El precio debe ser mayor a 0.' })
  standardPriceSocioUyu: number;

  @IsInt({ message: 'El precio debe ser un número entero.' })
  @Min(1, { message: 'El precio debe ser mayor a 0.' })
  premiumPriceUyu: number;

  @IsInt({ message: 'El precio debe ser un número entero.' })
  @Min(1, { message: 'El precio debe ser mayor a 0.' })
  premiumPriceSocioUyu: number;

  @IsInt({ message: 'El precio debe ser un número entero.' })
  @Min(1, { message: 'El precio debe ser mayor a 0.' })
  resetSessionPriceUyu: number;

  @IsInt({ message: 'El precio debe ser un número entero.' })
  @Min(1, { message: 'El precio debe ser mayor a 0.' })
  resetSessionPriceSocioUyu: number;
}
