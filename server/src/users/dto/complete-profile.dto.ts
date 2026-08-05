import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CompleteProfileDto {
  @Transform(trim)
  @IsString({ message: 'Ingresá un teléfono válido.' })
  @MinLength(6, { message: 'Ingresá un teléfono válido.' })
  phone: string;
}
