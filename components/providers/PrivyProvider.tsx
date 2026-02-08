'use client';

import { PrivyProvider as Privy } from '@privy-io/react-auth';
import { monadChain } from '@/config/chains';

interface PrivyProviderProps {
  children: React.ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    console.warn('NEXT_PUBLIC_PRIVY_APP_ID is not set. Authentication will not work.');
    return <>{children}</>;
  }

  return (
    <Privy
      appId={appId}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#7C3AED', // Purple accent matching Monad
          logo: '/logo.png',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: monadChain as any,
        supportedChains: [monadChain as any],
      }}
    >
      {children}
    </Privy>
  );
}

export default PrivyProvider;
