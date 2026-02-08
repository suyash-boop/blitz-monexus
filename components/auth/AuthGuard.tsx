'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function AuthGuard({ children, fallback, redirectTo }: AuthGuardProps) {
  const { ready, isConnected } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !isConnected && redirectTo) {
      router.push(redirectTo);
    }
  }, [ready, isConnected, redirectTo, router]);

  if (!ready) {
    return fallback || <div className="p-8 text-center text-gray-400">Loading...</div>;
  }

  if (!isConnected) {
    return fallback || (
      <div className="p-8 text-center">
        <p className="text-gray-400 mb-4">Please connect your wallet to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default AuthGuard;
