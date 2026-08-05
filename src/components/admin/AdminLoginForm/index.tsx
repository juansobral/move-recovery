import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../../../features/api/authApi';
import { credentialsSet } from '../../../features/auth/authSlice';
import { extractApiErrorMessage } from '../../../lib/apiError';
import { loginSchema, type LoginFormValues } from '../../../schemas/auth.schema';
import { useAppDispatch } from '../../../store/hooks';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

export const AdminLoginForm = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading }] = useLoginMutation();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { accessToken } = await login(values).unwrap();
      dispatch(credentialsSet({ token: accessToken }));
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/admin';
      navigate(from, { replace: true });
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  });

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border bg-card p-8">
      <a href="/" className="font-heading text-2xl font-black tracking-[2px]">
        MOVE<span className="align-super text-xs font-semibold">®</span>
      </a>
      <p className="mb-6 mt-1.5 text-sm text-muted-foreground">Panel de reservas</p>

      <div className="mb-4">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" autoComplete="username" {...register('email')} />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="mb-5">
        <Label htmlFor="login-password">Clave de acceso</Label>
        <Input id="login-password" type="password" autoComplete="current-password" {...register('password')} />
        {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <Button type="submit" size="block" disabled={isLoading}>
        {isLoading ? 'Verificando…' : 'Entrar'}
      </Button>

      {error && <p className="mt-3.5 text-sm text-destructive">{error}</p>}
    </form>
  );
};
