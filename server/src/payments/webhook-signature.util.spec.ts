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

  it('accepts a correctly-signed webhook', () => {
    const result = verifyWebhookSignature({ xSignature: validXSignature(), xRequestId, dataId, secret });
    expect(result).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const result = verifyWebhookSignature({ xSignature: validXSignature(), xRequestId, dataId, secret: 'wrong-secret' });
    expect(result).toBe(false);
  });

  it('rejects a signature for a different data id (tampered notification)', () => {
    const result = verifyWebhookSignature({ xSignature: validXSignature(), xRequestId, dataId: '999999999', secret });
    expect(result).toBe(false);
  });

  it('rejects a malformed x-signature header', () => {
    const result = verifyWebhookSignature({ xSignature: 'not-a-valid-header', xRequestId, dataId, secret });
    expect(result).toBe(false);
  });
});
