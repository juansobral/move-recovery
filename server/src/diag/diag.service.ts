import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { DiagResponse } from './diag.types';

// Muestra solo el principio y el final de una credencial — nunca el valor completo.
const pista = (v: string | undefined): string | null => {
  if (!v) return null;
  return v.length <= 12 ? `${v.slice(0, 3)}…` : `${v.slice(0, 8)}…${v.slice(-4)}`;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class DiagService {
  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly mail: MailService,
  ) {}

  async run(testEmail?: string): Promise<DiagResponse> {
    const env = {
      DATABASE_URL: this.config.get<string>('DATABASE_URL'),
      JWT_SECRET: this.config.get<string>('JWT_SECRET'),
      BREVO_API_KEY: this.config.get<string>('BREVO_API_KEY'),
      MAIL_FROM: this.config.get<string>('MAIL_FROM'),
      MAIL_ADMIN: this.config.get<string>('MAIL_ADMIN'),
      SITE_URL: this.config.get<string>('SITE_URL'),
      GOOGLE_CLIENT_ID: this.config.get<string>('GOOGLE_CLIENT_ID'),
      USER_JWT_SECRET: this.config.get<string>('USER_JWT_SECRET'),
      MP_ACCESS_TOKEN: this.config.get<string>('MP_ACCESS_TOKEN'),
      MP_WEBHOOK_SECRET: this.config.get<string>('MP_WEBHOOK_SECRET'),
    };

    const out: DiagResponse = {
      deploy: {
        commit: this.config.get<string>('VERCEL_GIT_COMMIT_SHA')?.slice(0, 7) || '(desconocido)',
        entorno: this.config.get<string>('VERCEL_ENV') || 'local',
        region: this.config.get<string>('VERCEL_REGION') || '—',
        hora: new Date().toISOString(),
      },
      variables: {},
      base_de_datos: {},
      emails: {},
      problemas: [],
      siguientes_pasos: [],
      resumen: '',
    };

    /* ---------------- Variables de entorno ---------------- */
    for (const [k, v] of Object.entries(env)) {
      out.variables[k] = v ? (k.includes('KEY') || k === 'DATABASE_URL' || k === 'JWT_SECRET' || k === 'USER_JWT_SECRET' || k === 'MP_ACCESS_TOKEN' || k === 'MP_WEBHOOK_SECRET' ? `configurada (${pista(v)})` : v) : 'FALTA';
    }

    if (!env.DATABASE_URL) out.problemas.push('Falta DATABASE_URL: no se pueden guardar reservas.');

    if (!env.BREVO_API_KEY) {
      out.problemas.push('Falta BREVO_API_KEY: los emails no se envían (las reservas sí se guardan).');
      out.siguientes_pasos.push('Creá una cuenta en brevo.com, verificá el remitente y generá una API key. Ver Paso 3 del DEPLOY.md.');
    } else if (!env.BREVO_API_KEY.startsWith('xkeysib-')) {
      out.problemas.push('BREVO_API_KEY no arranca con "xkeysib-". Puede que hayas copiado la SMTP key en lugar de la API key: son credenciales distintas.');
    }

    if (!env.MAIL_FROM) out.siguientes_pasos.push('Sin MAIL_FROM se usa movesc.performance@gmail.com por defecto. Tiene que estar verificado en Brevo.');
    if (!env.SITE_URL) out.siguientes_pasos.push('Sin SITE_URL los emails salen sin los links al sitio (no es grave).');
    else if (env.SITE_URL.endsWith('/')) out.problemas.push('SITE_URL termina en "/". Quitá la barra final para que los links no queden dobles.');

    /* ---------------- Base de datos ---------------- */
    if (env.DATABASE_URL) {
      try {
        const rows: Array<{ n: number }> = await this.dataSource.query('SELECT COUNT(*)::int AS n FROM bookings');
        out.base_de_datos = { conexion: 'OK', reservas_guardadas: rows?.[0]?.n ?? '(no se pudo contar)' };
      } catch (e) {
        out.base_de_datos = { conexion: 'ERROR', detalle: String((e as Error).message).slice(0, 200) };
        out.problemas.push('No se pudo conectar a Neon. Revisá que DATABASE_URL sea la connection string "pooled" y esté completa.');
      }
    } else {
      out.base_de_datos = { conexion: 'sin DATABASE_URL' };
    }

    /* ---------------- Cuenta de Brevo ---------------- */
    if (env.BREVO_API_KEY) {
      const from = env.MAIL_FROM || 'movesc.performance@gmail.com';
      try {
        const r = await fetch('https://api.brevo.com/v3/account', {
          headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
        });
        if (r.status === 401) {
          out.emails.cuenta = 'API key rechazada (401)';
          out.problemas.push('Brevo rechazó la API key. Generá una nueva en Settings → SMTP & API → API keys y actualizala en Vercel.');
        } else if (!r.ok) {
          out.emails.cuenta = `respuesta inesperada (${r.status})`;
        } else {
          const acc = await r.json();
          out.emails.cuenta = `OK — ${acc.email || ''}`.trim();
          const limite = acc.plan?.find?.((p: { credits?: number }) => p.credits != null);
          if (limite) out.emails.credito = `${limite.credits} emails disponibles (${limite.type})`;

          const sr = await fetch('https://api.brevo.com/v3/senders', {
            headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
          });
          if (sr.ok) {
            const { senders = [] } = await sr.json();
            const mine = senders.find((s: { email?: string }) => s.email?.toLowerCase() === from.toLowerCase());
            if (!mine) {
              out.emails.remitente = `${from} NO está dado de alta en Brevo`;
              out.problemas.push(`El remitente ${from} no existe en tu cuenta de Brevo. Agregalo en Settings → Senders y confirmá el mail que te llega.`);
            } else if (mine.active === false) {
              out.emails.remitente = `${from} dado de alta pero SIN VERIFICAR`;
              out.problemas.push(`El remitente ${from} está cargado pero no confirmado. Buscá el mail de Brevo en esa casilla (mirá también spam) y hacé clic en el link.`);
            } else {
              out.emails.remitente = `${from} verificado`;
            }
          }
        }
      } catch (e) {
        out.emails.cuenta = 'ERROR de red';
        out.emails.detalle = String((e as Error).message).slice(0, 200);
      }
    } else {
      out.emails.cuenta = 'sin BREVO_API_KEY';
    }

    /* ---------------- Envío de prueba ---------------- */
    if (testEmail) {
      if (!EMAIL_RE.test(testEmail)) {
        out.emails.prueba = 'el parámetro ?test= no es un email válido';
      } else if (!env.BREVO_API_KEY) {
        out.emails.prueba = 'no se puede probar sin BREVO_API_KEY';
      } else {
        const ejemplo = this.mail.mailCliente({
          id: 0,
          date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          time: '17:00',
          name: 'Prueba MOVE',
          email: testEmail,
          phone: '+598 99 000 000',
          service: 'Recovery Room',
          notes: 'Mail de prueba enviado desde /api/diag',
        });
        try {
          await this.mail.send({ ...ejemplo, subject: '[PRUEBA] Así se ve el mail de confirmación · MOVE®' });
          out.emails.prueba = `enviado a ${testEmail} — revisá la casilla y también spam`;
        } catch (e) {
          out.emails.prueba = 'FALLÓ';
          out.emails.prueba_detalle = String((e as Error).message).slice(0, 400);
          if (String((e as Error).message).includes('sender')) {
            out.problemas.push('Brevo rechazó el remitente. Tiene que ser una casilla verificada en tu cuenta.');
          }
        }
      }
    } else {
      out.emails.prueba = 'agregá &test=tu@email.com a esta URL para enviar un mail de prueba';
    }

    /* ---------------- Resumen ---------------- */
    out.resumen =
      out.problemas.length === 0
        ? 'Todo en orden. Los emails deberían estar saliendo.'
        : `${out.problemas.length} problema(s) a resolver — mirá la lista "problemas".`;

    return out;
  }
}
