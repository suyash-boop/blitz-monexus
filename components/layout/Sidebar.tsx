'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Trophy,
  User,
  Bot,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export function Sidebar() {
  const pathname = usePathname();
  const { isConnected, walletAddress } = useAuth();

  const profileHref = walletAddress ? `/profile/${walletAddress}` : '/profile';

  const navigation = [
    {
      name: 'Feed',
      href: '/feed',
      icon: Home,
      gradient: 'from-blue-500 to-cyan-400',
      glow: 'shadow-blue-500/25',
      activeBg: 'bg-blue-500/10',
      activeText: 'text-blue-400',
    },
    {
      name: 'Bounties',
      href: '/bounties',
      icon: Trophy,
      gradient: 'from-amber-500 to-orange-400',
      glow: 'shadow-amber-500/25',
      activeBg: 'bg-amber-500/10',
      activeText: 'text-amber-400',
    },
    {
      name: 'Predict',
      href: '/predictions',
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-green-400',
      glow: 'shadow-emerald-500/25',
      activeBg: 'bg-emerald-500/10',
      activeText: 'text-emerald-400',
    },
    {
      name: 'AI Agent',
      href: '/agent',
      icon: Bot,
      gradient: 'from-violet-500 to-purple-400',
      glow: 'shadow-violet-500/25',
      activeBg: 'bg-violet-500/10',
      activeText: 'text-violet-400',
    },
  ];

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:pt-16 lg:border-r lg:border-glass-border lg:bg-[#0a0a0f]/90 lg:backdrop-blur-xl">
      <div className="flex-1 flex flex-col overflow-y-auto py-5 px-3">
        {/* Create button */}
        {isConnected && (
          <Link
            href="/bounties/create"
            className="group relative flex items-center justify-center space-x-2 px-4 py-3.5 mb-6 rounded-xl font-medium transition-all duration-300 overflow-hidden"
          >
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-primary to-cyan-500 transition-all duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-primary to-cyan-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-300" />
            <div className="relative flex items-center space-x-2 text-white">
              <Sparkles size={18} className="group-hover:animate-pulse" />
              <span>Create Bounty</span>
            </div>
          </Link>
        )}

        {/* Section label */}
        <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-faint">
          Navigate
        </p>

        {/* Main navigation */}
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group relative flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? `${item.activeBg} ${item.activeText} border border-white/[0.06]`
                    : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className={cn(
                    'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b',
                    item.gradient
                  )} />
                )}

                {/* Icon with gradient container */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
                    isActive
                      ? `bg-gradient-to-br ${item.gradient} shadow-lg ${item.glow}`
                      : 'bg-white/[0.06] group-hover:bg-white/[0.10]'
                  )}
                >
                  <item.icon
                    size={16}
                    className={cn(
                      'transition-colors duration-200',
                      isActive ? 'text-white' : 'text-text-muted group-hover:text-text-secondary'
                    )}
                  />
                </div>

                <span className="font-medium text-sm">{item.name}</span>

                {/* Hover glow effect */}
                {isActive && (
                  <div className={cn(
                    'absolute inset-0 rounded-xl opacity-[0.03] bg-gradient-to-r',
                    item.gradient
                  )} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="my-4 mx-3 border-t border-glass-border" />

        {/* Profile link */}
        {isConnected && (
          <>
            <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-faint">
              Account
            </p>
            <nav className="space-y-1">
              <Link
                href={profileHref}
                className={cn(
                  'group relative flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200',
                  pathname?.startsWith('/profile')
                    ? 'bg-pink-500/10 text-pink-400 border border-white/[0.06]'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                )}
              >
                {pathname?.startsWith('/profile') && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-pink-500 to-rose-400" />
                )}
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
                    pathname?.startsWith('/profile')
                      ? 'bg-gradient-to-br from-pink-500 to-rose-400 shadow-lg shadow-pink-500/25'
                      : 'bg-white/[0.06] group-hover:bg-white/[0.10]'
                  )}
                >
                  <User
                    size={16}
                    className={cn(
                      'transition-colors duration-200',
                      pathname?.startsWith('/profile') ? 'text-white' : 'text-text-muted group-hover:text-text-secondary'
                    )}
                  />
                </div>
                <span className="font-medium text-sm">Profile</span>
              </Link>
            </nav>
          </>
        )}

        {/* Bottom decoration */}
        <div className="mt-auto px-4 pb-4">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-text-secondary">Monad Testnet</span>
            </div>
            <p className="text-[11px] text-text-faint leading-relaxed">
              Built on Monad for speed
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
