import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const API_URL = 'https://api.mercadopago.com';

export interface CreatePreferenceParams {
  title: string;
  amount: number;
  externalReference: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
}

export interface CreatePreapprovalParams {
  reason: string;
  amount: number;
  payerEmail: string;
  externalReference: string;
  backUrl: string;
}

export interface MpPayment {
  id: number;
  status: string;
  externalReference: string | null;
}

@Injectable()
export class MercadoPagoService {
  constructor(private readonly config: ConfigService) {}

  private get accessToken(): string {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) throw new Error('Falta MP_ACCESS_TOKEN.');
    return token;
  }

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${this.accessToken}`, 'content-type': 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`MercadoPago ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json();
  }

  async createPreference(params: CreatePreferenceParams): Promise<{ initPoint: string }> {
    const data = await this.request('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ title: params.title, quantity: 1, unit_price: params.amount, currency_id: 'UYU' }],
        external_reference: params.externalReference,
        back_urls: { success: params.successUrl, failure: params.failureUrl, pending: params.pendingUrl },
        auto_return: 'approved',
      }),
    });
    return { initPoint: data.init_point as string };
  }

  async createPreapproval(params: CreatePreapprovalParams): Promise<{ initPoint: string; preapprovalId: string }> {
    const data = await this.request('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: params.reason,
        external_reference: params.externalReference,
        payer_email: params.payerEmail,
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: params.amount, currency_id: 'UYU' },
        back_url: params.backUrl,
      }),
    });
    return { initPoint: data.init_point as string, preapprovalId: data.id as string };
  }

  async getPayment(paymentId: string): Promise<MpPayment> {
    const data = await this.request(`/v1/payments/${paymentId}`, { method: 'GET' });
    return {
      id: data.id as number,
      status: data.status as string,
      externalReference: (data.external_reference as string | undefined) ?? null,
    };
  }

  async refundPayment(paymentId: string): Promise<void> {
    await this.request(`/v1/payments/${paymentId}/refunds`, { method: 'POST' });
  }

  async cancelPreapproval(preapprovalId: string): Promise<void> {
    await this.request(`/preapproval/${preapprovalId}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
  }

  // Cobro recurrente concreto de una suscripción (el que llega por el topic
  // subscription_authorized_payment). OJO: a diferencia de /v1/payments/{id} y
  // /preapproval/{id}, MercadoPago no documenta del todo esta ruta ni el shape
  // de la respuesta — está implementada siguiendo su convención REST y debe
  // verificarse contra un sandbox real antes de confiar en producción (Task 20).
  async getAuthorizedPayment(authorizedPaymentId: string): Promise<{ status: string; preapprovalId: string | null }> {
    const data = await this.request(`/authorized_payments/${authorizedPaymentId}`, { method: 'GET' });
    return {
      status: data.status as string,
      preapprovalId: (data.preapproval_id as string | undefined) ?? null,
    };
  }

  async getPreapproval(preapprovalId: string): Promise<{ status: string; externalReference: string | null }> {
    const data = await this.request(`/preapproval/${preapprovalId}`, { method: 'GET' });
    return { status: data.status as string, externalReference: (data.external_reference as string | undefined) ?? null };
  }
}
