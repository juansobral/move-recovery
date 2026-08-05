import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Compartido entre bootstrap.ts (función serverless de Vercel) y main.ts
// (`nest start` local) para que ambos caminos apliquen exactamente la misma
// configuración global.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const first = errors[0];
        const message = first ? Object.values(first.constraints ?? {})[0] : 'Datos inválidos.';
        return new BadRequestException(message);
      },
    }),
  );
}
