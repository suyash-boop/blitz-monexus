'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { formatAddress, getAvatarUrl } from '@/lib/utils';
import { LogOut, Wallet } from 'lucide-react';

export function ConnectButton() {
  const { ready, isConnected, walletAddress, login, logout, getProvider } = useAuth();
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchBalance() {
      if (isConnected && walletAddress) {
        try {
          const provider = await getProvider();
          const bal = await provider.getBalance(walletAddress);
          if (!cancelled) {
            const formatted = ethers.formatEther(bal);
            // Show up to 4 decimal places
            setBalance(parseFloat(formatted).toFixed(4));
          }
        } catch {
          if (!cancelled) setBalance(null);
        }
      } else {
        setBalance(null);
      }
    }
    fetchBalance();
    // Refresh balance every 15 seconds
    const interval = setInterval(fetchBalance, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isConnected, walletAddress, getProvider]);

  if (!ready) {
    return (
      <Button variant="outline" size="sm" disabled>
        Loading...
      </Button>
    );
  }

  if (isConnected && walletAddress) {
    return (
      <div className="flex items-center space-x-2">
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-white/[0.06] border border-glass-border rounded-xl">
          <Avatar
            src={getAvatarUrl(walletAddress)}
            size="xs"
            alt={walletAddress}
          />
          <span className="text-sm text-text-secondary">
            {formatAddress(walletAddress)}
          </span>
          {balance !== null && (
            <span className="text-xs text-green-400 font-mono ml-1">
              {balance} MON
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-text-muted hover:text-text-primary"
        >
          <LogOut size={18} />
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={login} size="sm">
      <Wallet size={18} className="mr-2" />
      Connect Wallet
    </Button>
  );
}

export default ConnectButton;
