'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function ProfileRedirect() {
  const router = useRouter();
  const { isConnected, walletAddress, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (isConnected && walletAddress) {
      router.replace(`/profile/${walletAddress}`);
    } else {
      router.replace('/feed');
    }
  }, [ready, isConnected, walletAddress, router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="w-8 h-8 border-2 border-gray-600 border-t-purple-400 rounded-full animate-spin mx-auto" />
      <p className="text-gray-500 text-sm mt-4">Redirecting...</p>
    </div>
  );
}
