import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

// Reformatea toda excepción HTTP a { error: '<mensaje en español>' }, el único
// formato que el frontend sabe leer (ver app.js/admin.js: `data.error || fallback`).
// Sin este filtro, los defaults de Nest devuelven `error` como la frase HTTP
// ("Bad Request") en vez del mensaje real — rompe todos los mensajes de error
// del front de forma silenciosa (el status code sigue siendo correcto).
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : Array.isArray((body as { message?: unknown }).message)
            ? ((body as { message: string[] }).message[0] ?? 'Error del servidor.')
            : ((body as { message?: string }).message ?? 'Error del servidor.');

      res.status(status).json({ error: message });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Error del servidor.' });
  }
}
