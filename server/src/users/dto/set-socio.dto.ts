import { IsBoolean } from 'class-validator';

export class SetSocioDto {
  @IsBoolean()
  isSocio: boolean;
}
