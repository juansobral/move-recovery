import { Navigate } from 'react-router-dom';
import { AdminLoginForm } from '../../components/admin/AdminLoginForm';
import { selectIsAuthenticated } from '../../features/auth/authSlice';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAppSelector } from '../../store/hooks';

export const AdminLoginPage = (): JSX.Element => {
  useDocumentTitle('Reservas · Admin · MOVE®');
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <AdminLoginForm />
    </div>
  );
};
