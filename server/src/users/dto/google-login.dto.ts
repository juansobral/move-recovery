import { IsString, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @MinLength(10, { message: 'Credenciales inválidas.' })
  idToken: string;
}
