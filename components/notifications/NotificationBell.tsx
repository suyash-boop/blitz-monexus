'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Trophy, Heart, MessageCircle, FileText, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatRelativeTime, formatAddress } from '@/lib/utils';
import Link from 'next/link';

interface NotificationActor {
  walletAddress: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Notification {
  id: string;
  type: 'BOUNTY_WON' | 'LIKE' | 'COMMENT' | 'SUBMISSION_RECEIVED';
  message: string;
  read: boolean;
  createdAt: string;
  postId: string | null;
  bountyId: string | null;
  actor: NotificationActor | null;
}

const typeIcons: Record<string, React.ReactNode> = {
  BOUNTY_WON: <Trophy size={14} className="text-yellow-400" />,
  LIKE: <Heart size={14} className="text-pink-400" />,
  COMMENT: <MessageCircle size={14} className="text-blue-400" />,
  SUBMISSION_RECEIVED: <FileText size={14} className="text-primary-text" />,
};

export function NotificationBell() {
  const { isConnected, walletAddress } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/notifications?walletAddress=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [walletAddress]);

  // Fetch on mount and poll every 30s
  useEffect(() => {
    if (!isConnected || !walletAddress) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isConnected, walletAddress, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markAllRead() {
    if (!walletAddress) return;
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  }

  function getNotificationHref(n: Notification): string {
    if (n.bountyId) return `/bounties/${n.bountyId}`;
    if (n.postId) return `/feed`;
    return '/feed';
  }

  function getActorName(actor: NotificationActor | null): string {
    if (!actor) return 'Someone';
    return actor.displayName || formatAddress(actor.walletAddress);
  }

  if (!isConnected) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-muted hover:text-text-primary hover:bg-white/[0.06] rounded-lg transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 glass-elevated rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
            <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary-text hover:text-primary-hover transition-colors"
              >
                <Check size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={20} className="text-text-faint mx-auto mb-2" />
                <p className="text-sm text-text-muted">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={getNotificationHref(n)}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-glass-border last:border-0 ${
                    !n.read ? 'bg-primary-soft' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {typeIcons[n.type] || <Bell size={14} className="text-text-secondary" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-secondary">
                      {n.type === 'BOUNTY_WON' ? (
                        n.message
                      ) : (
                        <>
                          <span className="text-text-primary font-medium">{getActorName(n.actor)}</span>{' '}
                          {n.message}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{formatRelativeTime(n.createdAt)}</p>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <div className="mt-1.5 w-2 h-2 bg-primary rounded-full shrink-0" />
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
