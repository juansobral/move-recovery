import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoginWithGoogleMutation } from '../features/api/userApi';
import { credentialsSet } from '../features/userAuth/userAuthSlice';
import { extractApiErrorMessage } from '../lib/apiError';
import { useAppDispatch } from '../store/hooks';

export function useGoogleAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [loginWithGoogle, { isLoading }] = useLoginWithGoogleMutation();
  const [error, setError] = useState<string | null>(null);

  const handleCredential = useCallback(
    async (idToken: string) => {
      setError(null);
      try {
        const { accessToken, profileComplete } = await loginWithGoogle({ idToken }).unwrap();
        dispatch(credentialsSet({ token: accessToken, profileComplete }));
        if (!profileComplete) navigate('/completar-perfil');
      } catch (err) {
        setError(extractApiErrorMessage(err));
      }
    },
    [dispatch, navigate, loginWithGoogle],
  );

  return { handleCredential, isLoading, error };
}
