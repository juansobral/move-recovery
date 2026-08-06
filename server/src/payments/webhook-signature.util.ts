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
// `nowSeconds` es parámetro (y no Date.now() directo) solo para poder testear
// la ventana de frescura con timestamps fijos.
export function verifyWebhookSignature(
  { xSignature, xRequestId, dataId, secret }: WebhookSignatureInput,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const parts: Record<string, string> = {};
  for (const part of xSignature.split(',')) {
    const [key, value] = part.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  }

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) {
    console.warn(`[mp-webhook] x-signature sin ts/v1 parseables: "${xSignature}"`);
    return false;
  }

  // Una firma válida sigue siéndolo para siempre: sin ventana de frescura,
  // quien capture una notificación puede reproducirla cuando quiera.
  const tsNumber = Number(ts);
  if (!Number.isFinite(tsNumber) || Math.abs(nowSeconds - tsNumber) > 300) {
    console.warn(`[mp-webhook] ts fuera de la ventana de frescura: ts=${ts} now=${nowSeconds} diff=${nowSeconds - tsNumber}s`);
    return false;
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(v1, 'hex');
  if (expectedBuf.length !== actualBuf.length) {
    console.warn(`[mp-webhook] largo de firma inesperado: esperado=${expectedBuf.length}B recibido=${actualBuf.length}B manifest="${manifest}"`);
    return false;
  }
  const matches = timingSafeEqual(expectedBuf, actualBuf);
  if (!matches) {
    console.warn(`[mp-webhook] firma no coincide — manifest="${manifest}" esperado=${expected} recibido=${v1}`);
  }
  return matches;
}
