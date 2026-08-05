import { Navigate, Outlet } from 'react-router-dom';
import { selectIsCustomerAuthenticated } from '../../features/userAuth/userAuthSlice';
import { useAppSelector } from '../../store/hooks';

export const RequireUserAuth = (): JSX.Element => {
  const isAuthenticated = useAppSelector(selectIsCustomerAuthenticated);
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
};
