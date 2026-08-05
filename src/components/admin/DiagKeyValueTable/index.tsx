import { DIAG_BAD_PATTERN, DIAG_OK_PATTERN } from '../../../lib/diagHeuristics';

interface DiagKeyValueTableProps {
  title: string;
  data: Record<string, string | number> | undefined;
}

export const DiagKeyValueTable = ({ title, data }: DiagKeyValueTableProps): JSX.Element | null => {
  const entries = Object.entries(data ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return null;

  return (
    <div className="mb-5">
      <h4 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{title}</h4>
      <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
        <tbody>
          {entries.map(([k, v]) => {
            const text = String(v);
            const bad = DIAG_BAD_PATTERN.test(text);
            const good = DIAG_OK_PATTERN.test(text);
            return (
              <tr key={k} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2 text-muted-foreground">{k.replace(/_/g, ' ')}</td>
                <td className={`px-3 py-2 ${bad ? 'text-destructive' : good ? 'text-success' : ''}`}>{text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
