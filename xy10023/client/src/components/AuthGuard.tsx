import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/stores/auth.store';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, tokens } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated && tokens?.accessToken) {
      localStorage.setItem('accessToken', tokens.accessToken);
    }
  }, [isAuthenticated, tokens]);

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return <>{children}</>;
}

export default AuthGuard;
