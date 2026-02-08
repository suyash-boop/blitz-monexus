'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, User, PlusCircle, Bot, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export function MobileNav() {
  const pathname = usePathname();
  const { isConnected, walletAddress } = useAuth();

  const profileHref = walletAddress ? `/profile/${walletAddress}` : '/profile';

  const navigation = [
    { name: 'Feed', href: '/feed', icon: Home },
    { name: 'Bounties', href: '/bounties', icon: Trophy },
    { name: 'Predict', href: '/predictions', icon: TrendingUp },
    { name: 'AI', href: '/agent', icon: Bot },
    ...(isConnected
      ? [
          { name: 'Create', href: '/bounties/create', icon: PlusCircle, isCreate: true },
          { name: 'Profile', href: profileHref, icon: User },
        ]
      : []),
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-xl border-t border-glass-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const isCreate = 'isCreate' in item && item.isCreate;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isCreate
                  ? 'text-primary-text'
                  : isActive
                  ? 'text-text-primary'
                  : 'text-text-muted'
              )}
            >
              {isCreate ? (
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center -mt-4 shadow-lg shadow-primary/25">
                  <item.icon size={20} className="text-white" />
                </div>
              ) : (
                <>
                  <item.icon size={22} />
                  <span className="text-xs mt-1">{item.name}</span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileNav;
