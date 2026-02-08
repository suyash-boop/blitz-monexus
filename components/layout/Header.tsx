'use client';

import Link from 'next/link';
import { Home, Trophy, User, Menu, X, Bot, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { ConnectButton } from '@/components/auth/ConnectButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isConnected, walletAddress } = useAuth();

  const profileHref = walletAddress ? `/profile/${walletAddress}` : '/profile';

  return (
    <header className="sticky top-0 z-30 bg-[#0a0a0f]/70 backdrop-blur-xl border-b border-glass-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-text-primary tracking-tight">Monexus</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            <NavLink href="/feed" icon={<Home size={20} />}>
              Feed
            </NavLink>
            <NavLink href="/bounties" icon={<Trophy size={20} />}>
              Bounties
            </NavLink>
            <NavLink href="/predictions" icon={<TrendingUp size={20} />}>
              Predict
            </NavLink>
            <NavLink href="/agent" icon={<Bot size={20} />}>
              AI Agent
            </NavLink>
            {isConnected && (
              <NavLink href={profileHref} icon={<User size={20} />}>
                Profile
              </NavLink>
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center space-x-2">
            <NotificationBell />
            <ConnectButton />

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-text-muted hover:text-text-primary transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-glass-border">
            <div className="flex flex-col space-y-1">
              <MobileNavLink href="/feed" icon={<Home size={20} />} onClick={() => setIsMobileMenuOpen(false)}>
                Feed
              </MobileNavLink>
              <MobileNavLink href="/bounties" icon={<Trophy size={20} />} onClick={() => setIsMobileMenuOpen(false)}>
                Bounties
              </MobileNavLink>
              <MobileNavLink href="/predictions" icon={<TrendingUp size={20} />} onClick={() => setIsMobileMenuOpen(false)}>
                Predict
              </MobileNavLink>
              <MobileNavLink href="/agent" icon={<Bot size={20} />} onClick={() => setIsMobileMenuOpen(false)}>
                AI Agent
              </MobileNavLink>
              {isConnected && (
                <MobileNavLink href={profileHref} icon={<User size={20} />} onClick={() => setIsMobileMenuOpen(false)}>
                  Profile
                </MobileNavLink>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center space-x-2 px-4 py-2 text-text-muted hover:text-text-primary hover:bg-white/[0.06] rounded-lg transition-all duration-200"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function MobileNavLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center space-x-3 px-4 py-3 text-text-muted hover:text-text-primary hover:bg-white/[0.06] rounded-lg transition-all duration-200"
    >
      {icon}
      <span className="font-medium">{children}</span>
    </Link>
  );
}

export default Header;
