import { useMemo, useState } from 'react';
import { AdminTopNav } from '../../components/admin/AdminTopNav';
import { StatTile } from '../../components/admin/StatTile';
import { useGetAdminUsersQuery, useSetUserSocioMutation } from '../../features/api/adminUsersApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { extractApiErrorMessage } from '../../lib/apiError';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

type PlanFilter = '__all__' | 'standard' | 'premium' | 'none';

const planLabel = (plan: 'standard' | 'premium' | null): string => {
  if (plan === 'standard') return 'Standard Reset';
  if (plan === 'premium') return 'Premium Reset';
  return 'Sin plan';
};

export const AdminUsersPage = (): JSX.Element => {
  useDocumentTitle('Usuarios · Admin · MOVE®');
  const { data: users = [], isFetching, refetch } = useGetAdminUsersQuery();
  const [setSocio] = useSetUserSocioMutation();
  const [q, setQ] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('__all__');
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      total: users.length,
      standardActivos: users.filter((u) => u.plan === 'standard' && u.planStatus === 'authorized').length,
      premiumActivos: users.filter((u) => u.plan === 'premium' && u.planStatus === 'authorized').length,
    }),
    [users],
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return users
      .filter((u) => !query || `${u.name} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(query))
      .filter((u) => {
        if (planFilter === '__all__') return true;
        if (planFilter === 'none') return u.plan === null;
        return u.plan === planFilter;
      });
  }, [users, q, planFilter]);

  const handleSocioChange = async (id: string, isSocio: boolean) => {
    setError(null);
    try {
      await setSocio({ id, isSocio }).unwrap();
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  };

  return (
    <div>
      <AdminTopNav onReload={refetch} isReloading={isFetching} />
      <main className="mx-auto max-w-site space-y-6 px-8 py-8 max-md:px-5">
        <h1 className="font-heading text-2xl uppercase tracking-wide">Usuarios</h1>

        <div className="grid gap-4 max-md:grid-cols-2 md:grid-cols-3">
          <StatTile label="Usuarios registrados" value={stats.total} />
          <StatTile label="Planes Standard activos" value={stats.standardActivos} />
          <StatTile label="Planes Premium activos" value={stats.premiumActivos} />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] max-w-sm flex-1">
            <Label htmlFor="users-search">Buscar</Label>
            <Input
              id="users-search"
              type="search"
              placeholder="Nombre, email o teléfono"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="w-[200px]">
            <Label htmlFor="users-plan-filter">Plan</Label>
            <Select value={planFilter} onValueChange={(value) => setPlanFilter(value as PlanFilter)}>
              <SelectTrigger id="users-plan-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="standard">Standard Reset</SelectItem>
                <SelectItem value="premium">Premium Reset</SelectItem>
                <SelectItem value="none">Sin plan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Contacto</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Plan</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Socio del club</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">
                    <div>{u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.phone ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.plan ? (
                      <Badge highlighted={u.planStatus === 'authorized'}>
                        {planLabel(u.plan)}
                        {u.planStatus === 'cancelled' && ' (cancelado)'}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin plan</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={u.isSocio}
                      onCheckedChange={(checked) => handleSocioChange(u.id, checked === true)}
                      aria-label={`Socio del club: ${u.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isFetching && rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
          )}
          {!isFetching && rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No hay usuarios para este filtro.</p>
          )}
        </div>
      </main>
    </div>
  );
};
