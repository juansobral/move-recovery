import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loggedOut } from '../../../features/auth/authSlice';
import { useAppDispatch } from '../../../store/hooks';
import { Button } from '../../ui/button';
import { DiagnosticsDialog } from '../DiagnosticsDialog';

interface AdminTopNavProps {
  onReload: () => void;
  isReloading: boolean;
}

export const AdminTopNav = ({ onReload, isReloading }: AdminTopNavProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const [diagOpen, setDiagOpen] = useState(false);

  return (
    <header className="flex items-center justify-between border-b border-border px-8 py-4 max-md:px-5">
      <div className="flex items-center gap-3">
        <Link to="/" className="font-heading text-2xl font-black tracking-[2px]">
          MOVE<span className="align-super text-xs font-semibold">®</span>
        </Link>
        <span className="rounded-md border border-border px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">Admin</span>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin">Reservas</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/usuarios">Usuarios</Link>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDiagOpen(true)}>
          Diagnóstico
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onReload} disabled={isReloading}>
          {isReloading ? '…' : 'Actualizar'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => dispatch(loggedOut())}>
          Salir
        </Button>
      </div>
      <DiagnosticsDialog open={diagOpen} onOpenChange={setDiagOpen} />
    </header>
  );
};
