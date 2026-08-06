import { createHmac } from 'crypto';
import { verifyWebhookSignature } from './webhook-signature.util';

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret';
  const dataId = '123456789';
  const xRequestId = 'req-abc-123';
  const ts = '1704908010';

  const validXSignature = () => {
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
    return `ts=${ts},v1=${v1}`;
  };

  // El ts del fixture es fijo, así que hay que pasar el "ahora" explícito para
  // que caiga dentro de la ventana de frescura.
  const NOW = Number(ts);

  it('accepts a correctly-signed webhook', () => {
    const result = verifyWebhookSignature({ xSignature: validXSignature(), xRequestId, dataId, secret }, NOW);
    expect(result).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const result = verifyWebhookSignature({ xSignature: validXSignature(), xRequestId, dataId, secret: 'wrong-secret' }, NOW);
    expect(result).toBe(false);
  });

  it('rejects a signature for a different data id (tampered notification)', () => {
    const result = verifyWebhookSignature({ xSignature: validXSignature(), xRequestId, dataId: '999999999', secret }, NOW);
    expect(result).toBe(false);
  });

  it('rejects a malformed x-signature header', () => {
    const result = verifyWebhookSignature({ xSignature: 'not-a-valid-header', xRequestId, dataId, secret }, NOW);
    expect(result).toBe(false);
  });

  it('rejects a valid signature whose timestamp is outside the freshness window (replay)', () => {
    const result = verifyWebhookSignature({ xSignature: validXSignature(), xRequestId, dataId, secret }, NOW + 301);
    expect(result).toBe(false);
  });
});
