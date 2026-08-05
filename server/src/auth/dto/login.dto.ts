import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Credenciales inválidas.' })
  email: string;

  @IsString({ message: 'Credenciales inválidas.' })
  @MinLength(1, { message: 'Credenciales inválidas.' })
  password: string;
}
