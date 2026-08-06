import type { ApiErrorShape } from './axiosBaseQuery';

const FALLBACK = 'Error de conexión. Intentá nuevamente.';

export function extractApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const message = (err as ApiErrorShape).error;
    return typeof message === 'string' && message ? message : FALLBACK;
  }
  // Errores lanzados localmente antes de llegar a la API (ej. "Elegí un
  // horario.") no tienen la forma de un error de RTK Query — sin esto,
  // terminaban mostrando el mensaje genérico de conexión.
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return FALLBACK;
}
