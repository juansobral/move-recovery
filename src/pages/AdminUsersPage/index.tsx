import { useMemo, useState } from 'react';
import { AdminTopNav } from '../../components/admin/AdminTopNav';
import { useGetAdminUsersQuery, useSetUserSocioMutation } from '../../features/api/adminUsersApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { extractApiErrorMessage } from '../../lib/apiError';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export const AdminUsersPage = (): JSX.Element => {
  useDocumentTitle('Usuarios · Admin · MOVE®');
  const { data: users = [], isFetching, refetch } = useGetAdminUsersQuery();
  const [setSocio] = useSetUserSocioMutation();
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) => `${u.name} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(query));
  }, [users, q]);

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

        <div className="max-w-sm">
          <Label htmlFor="users-search">Buscar</Label>
          <Input
            id="users-search"
            type="search"
            placeholder="Nombre, email o teléfono"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">Contacto</th>
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
