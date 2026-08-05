import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoginWithGoogleMutation } from '../features/api/userApi';
import { credentialsSet } from '../features/userAuth/userAuthSlice';
import { useAppDispatch } from '../store/hooks';

export function useGoogleAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [loginWithGoogle, { isLoading }] = useLoginWithGoogleMutation();

  const handleCredential = useCallback(
    async (idToken: string) => {
      const { accessToken, profileComplete } = await loginWithGoogle({ idToken }).unwrap();
      dispatch(credentialsSet({ token: accessToken, profileComplete }));
      if (!profileComplete) navigate('/completar-perfil');
    },
    [dispatch, navigate, loginWithGoogle],
  );

  return { handleCredential, isLoading };
}
