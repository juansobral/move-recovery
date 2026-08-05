import { useEffect, useState } from 'react';
import { useLazyGetDiagQuery } from '../../../features/api/diagApi';
import { extractApiErrorMessage } from '../../../lib/apiError';
import { testEmailSchema } from '../../../schemas/auth.schema';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { DiagKeyValueTable } from '../DiagKeyValueTable';

interface DiagnosticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DiagnosticsDialog = ({ open, onOpenChange }: DiagnosticsDialogProps): JSX.Element => {
  const [trigger, { data, isFetching, error }] = useLazyGetDiagQuery();
  const [testEmail, setTestEmail] = useState('');
  const [testMessage, setTestMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    if (open) {
      setTestMessage(null);
      trigger();
    }
  }, [open, trigger]);

  const sendTest = async () => {
    const parsed = testEmailSchema.safeParse(testEmail);
    if (!parsed.success) {
      setTestMessage({ kind: 'err', text: parsed.error.issues[0]?.message ?? 'Poné un email válido.' });
      return;
    }
    setTestMessage({ kind: 'ok', text: 'Enviando…' });
    const result = await trigger({ test: parsed.data });
    const prueba = result.data?.emails?.prueba ?? '';
    const ok = prueba.includes('enviado');
    setTestMessage({
      kind: ok ? 'ok' : 'err',
      text: ok ? `✓ ${prueba}` : `✗ ${prueba}${result.data?.emails?.prueba_detalle ? ' · ' + result.data.emails.prueba_detalle : ''}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Diagnóstico de configuración</DialogTitle>
        </DialogHeader>

        {isFetching && !data && <p className="text-sm text-muted-foreground">Consultando…</p>}
        {error && <p className="text-sm text-destructive">{extractApiErrorMessage(error)}</p>}

        {data && (
          <div>
            <div
              className={`mb-4 rounded-lg border p-4 text-sm ${data.problemas.length ? 'border-destructive/50 text-destructive' : 'border-success/50 text-success'}`}
            >
              {data.problemas.length ? (
                <>
                  <strong>{data.problemas.length} problema(s)</strong>
                  <ul className="mt-2 list-disc pl-5">
                    {data.problemas.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <strong>{data.resumen}</strong>
              )}
            </div>

            {data.siguientes_pasos.length > 0 && (
              <div className="mb-4 rounded-lg border border-border p-4 text-sm">
                <strong>Siguientes pasos</strong>
                <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                  {data.siguientes_pasos.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <DiagKeyValueTable title="Emails (Brevo)" data={data.emails} />
            <DiagKeyValueTable title="Base de datos" data={data.base_de_datos} />
            <DiagKeyValueTable title="Variables de entorno" data={data.variables} />
            <DiagKeyValueTable title="Deploy" data={data.deploy} />
          </div>
        )}

        <div className="flex items-end gap-3 border-t border-border pt-4">
          <div className="flex-1">
            <Label htmlFor="diag-test-email">Enviar un mail de prueba a</Label>
            <Input id="diag-test-email" type="email" placeholder="tu@email.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          </div>
          <Button type="button" size="sm" onClick={sendTest}>
            Enviar prueba
          </Button>
        </div>
        {testMessage && <p className={`text-sm ${testMessage.kind === 'ok' ? 'text-success' : 'text-destructive'}`}>{testMessage.text}</p>}
      </DialogContent>
    </Dialog>
  );
};
