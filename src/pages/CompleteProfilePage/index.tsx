import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useCompleteProfileMutation } from '../../features/api/userApi';
import { profileCompleted } from '../../features/userAuth/userAuthSlice';
import { extractApiErrorMessage } from '../../lib/apiError';
import { useAppDispatch } from '../../store/hooks';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const phoneSchema = z.object({ phone: z.string().trim().min(6, 'Ingresá un teléfono válido.') });
type PhoneFormValues = z.infer<typeof phoneSchema>;

export const CompleteProfilePage = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [completeProfile, { isLoading }] = useCompleteProfileMutation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<PhoneFormValues>({ resolver: zodResolver(phoneSchema) });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await completeProfile(values).unwrap();
      dispatch(profileCompleted());
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractApiErrorMessage(err));
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border bg-card p-8">
        <h1 className="mb-2 font-heading text-xl uppercase tracking-wide">Completá tu perfil</h1>
        <p className="mb-6 text-sm text-muted-foreground">Necesitamos tu teléfono para poder avisarte sobre tus reservas.</p>

        <div className="mb-5">
          <Label htmlFor="profile-phone">Teléfono / WhatsApp</Label>
          <Input id="profile-phone" type="tel" {...register('phone')} />
          {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        <Button type="submit" size="block" disabled={isLoading}>
          {isLoading ? 'Guardando…' : 'Continuar'}
        </Button>
        {error && <p className="mt-3.5 text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
};
