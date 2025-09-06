import React from 'react';
import { useAuthPersistence } from '../../hooks/useAuthPersistence';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  // Use the comprehensive auth persistence hook
  useAuthPersistence();

  return <>{children}</>;
};

export default AuthGuard;