import { IsBoolean, IsString } from 'class-validator';

export class UpdateDiscountCodeDto {
  @IsString({ message: 'El código debe ser texto.' })
  code: string;

  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso.' })
  active: boolean;
}
