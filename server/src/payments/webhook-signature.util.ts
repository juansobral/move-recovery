import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookSignatureInput {
  xSignature: string;
  xRequestId: string;
  dataId: string;
  secret: string;
}

// Algoritmo documentado por MercadoPago para validar notificaciones webhook:
// el header x-signature trae "ts=<timestamp>,v1=<hmac>"; el manifest a firmar
// es "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (data.id en minúsculas).
export function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret }: WebhookSignatureInput): boolean {
  const parts: Record<string, string> = {};
  for (const part of xSignature.split(',')) {
    const [key, value] = part.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  }

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(v1, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
