import type { ApiErrorShape } from './axiosBaseQuery';

const FALLBACK = 'Error de conexión. Intentá nuevamente.';

export function extractApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const message = (err as ApiErrorShape).error;
    return typeof message === 'string' && message ? message : FALLBACK;
  }
  return FALLBACK;
}
