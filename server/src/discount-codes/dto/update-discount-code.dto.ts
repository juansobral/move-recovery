import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateDiscountCodeDto {
  @IsString({ message: 'El código debe ser texto.' })
  @IsNotEmpty({ message: 'El código no puede estar vacío.' })
  @MaxLength(64, { message: 'El código es demasiado largo.' })
  code: string;

  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso.' })
  active: boolean;
}
