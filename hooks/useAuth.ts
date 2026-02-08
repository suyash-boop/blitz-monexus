'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useMemo, useCallback, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { MONAD_CHAIN_ID } from '@/config/chains';

export function useAuth() {
  const {
    ready,
    authenticated,
    user,
    login,
    logout,
    linkWallet,
  } = usePrivy();

  const { wallets } = useWallets();

  // Get the primary wallet address
  const walletAddress = useMemo(() => {
    return user?.wallet?.address || wallets[0]?.address;
  }, [user, wallets]);

  // Get the active wallet for transactions
  const activeWallet = useMemo(() => {
    return wallets.find((w) => w.address === walletAddress) || wallets[0];
  }, [wallets, walletAddress]);

  // Check if user is connected
  const isConnected = useMemo(() => {
    return ready && authenticated && !!walletAddress;
  }, [ready, authenticated, walletAddress]);

  // Auto-register user in DB on wallet connect
  const registeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (isConnected && walletAddress && registeredRef.current !== walletAddress) {
      registeredRef.current = walletAddress;
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          privyUserId: user?.id,
        }),
      }).catch((err) => {
        console.error('Failed to register user:', err);
        registeredRef.current = null;
      });
    }
  }, [isConnected, walletAddress, user?.id]);

  // Get ethers provider from wallet
  const getProvider = useCallback(async () => {
    if (!activeWallet) {
      throw new Error('No wallet connected');
    }
    // Switch wallet to Monad Testnet before getting provider
    try {
      await activeWallet.switchChain(MONAD_CHAIN_ID);
    } catch (e) {
      console.warn('Failed to switch chain, continuing anyway:', e);
    }
    // Get the Ethereum provider from Privy wallet and wrap with ethers
    const ethereumProvider = await activeWallet.getEthereumProvider();
    return new ethers.BrowserProvider(ethereumProvider);
  }, [activeWallet]);

  // Get ethers signer from wallet
  const getSigner = useCallback(async () => {
    const provider = await getProvider();
    return provider.getSigner();
  }, [getProvider]);

  return {
    // State
    ready,
    authenticated,
    isConnected,
    user,
    walletAddress,
    wallets,
    activeWallet,

    // Actions
    login,
    logout,
    linkWallet,
    getProvider,
    getSigner,
  };
}

export default useAuth;
