'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ethers } from 'ethers';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { PostCard } from '@/components/posts/PostCard';
import { useAuth } from '@/hooks/useAuth';
import { MONAD_RPC_URL } from '@/config/chains';
import {
  Trophy,
  FileText,
  Star,
  ArrowLeft,
  Copy,
  Check,
  Wallet,
  Clock,
  Award,
  MessageSquare,
  Coins,
  Camera,
  Loader2,
} from 'lucide-react';
import { formatAddress, formatMON, getAvatarUrl } from '@/lib/utils';
import { useUploadThing } from '@/lib/uploadthing-components';

interface UserProfile {
  id: string;
  walletAddress: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  reputation: {
    bountiesCompleted: number;
    bountiesCreated: number;
    totalEarned: string;
    totalSpent: string;
  } | null;
}

type TabType = 'posts' | 'created' | 'completed';

export default function ProfilePage() {
  const params = useParams();
  const { walletAddress: myAddress } = useAuth();
  const address = params.address as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [createdBounties, setCreatedBounties] = useState<any[]>([]);
  const [completedBounties, setCompletedBounties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('posts');
  const [copied, setCopied] = useState(false);
  const [monBalance, setMonBalance] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const { startUpload } = useUploadThing('avatarUpload');

  const isOwnProfile = myAddress?.toLowerCase() === address?.toLowerCase();

  useEffect(() => {
    fetchProfile();
    fetchPosts();
    fetchCreatedBounties();
    fetchCompletedBounties();
    fetchBalance();
  }, [address]);

  async function fetchBalance() {
    try {
      const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
      const balance = await provider.getBalance(address);
      setMonBalance(ethers.formatEther(balance));
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }

  async function fetchProfile() {
    try {
      const res = await fetch(`/api/users?address=${address}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPosts() {
    try {
      const res = await fetch(`/api/posts?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setPosts(
          data.posts?.filter(
            (p: any) => p.author.walletAddress.toLowerCase() === address.toLowerCase()
          ) || []
        );
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  }

  async function fetchCreatedBounties() {
    try {
      const res = await fetch(`/api/bounties?creator=${address}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setCreatedBounties(data.bounties || []);
      }
    } catch (err) {
      console.error('Failed to fetch created bounties:', err);
    }
  }

  async function fetchCompletedBounties() {
    try {
      const res = await fetch(`/api/bounties?winner=${address}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setCompletedBounties(data.bounties || []);
      }
    } catch (err) {
      console.error('Failed to fetch completed bounties:', err);
    }
  }

  function handleCopyAddress() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !myAddress) return;

    setUploadingAvatar(true);
    try {
      const result = await startUpload([file]);
      if (!result?.[0]) throw new Error('Upload failed');

      const avatarUrl = result[0].ufsUrl;
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: myAddress, avatarUrl }),
      });

      setUser((prev) => prev ? { ...prev, avatarUrl } : prev);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploadingAvatar(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'OPEN': return 'text-green-400 bg-green-400/10';
      case 'IN_REVIEW': return 'text-yellow-400 bg-yellow-400/10';
      case 'COMPLETED': return 'text-blue-400 bg-blue-400/10';
      case 'CANCELLED': return 'text-gray-400 bg-gray-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-purple-400 rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm mt-4">Loading profile...</p>
      </div>
    );
  }

  const reputation = user?.reputation;

  const tabs: { key: TabType; label: string; mobileLabel: string; count: number; icon: React.ReactNode }[] = [
    { key: 'posts', label: 'Posts', mobileLabel: 'Posts', count: posts.length, icon: <MessageSquare size={16} /> },
    { key: 'created', label: 'Bounties Created', mobileLabel: 'Created', count: createdBounties.length, icon: <FileText size={16} /> },
    { key: 'completed', label: 'Bounties Won', mobileLabel: 'Won', count: completedBounties.length, icon: <Award size={16} /> },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back */}
      <Link
        href="/feed"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-5 transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Back</span>
      </Link>

      {/* Profile Header */}
      <Card className="mb-6" padding="lg">
        <div className="flex items-start gap-4">
          <div className="relative group">
            <Avatar
              src={user?.avatarUrl || getAvatarUrl(address)}
              size="lg"
              alt={user?.displayName || address}
            />
            {isOwnProfile && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                {uploadingAvatar ? (
                  <Loader2 size={20} className="text-white animate-spin" />
                ) : (
                  <Camera size={20} className="text-white" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white truncate">
                {user?.displayName || formatAddress(address)}
              </h1>
              {isOwnProfile && (
                <Badge variant="purple" size="sm">You</Badge>
              )}
            </div>

            {/* Wallet address */}
            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 mt-1 transition-colors"
            >
              <Wallet size={14} />
              <span className="font-mono">{formatAddress(address, 6)}</span>
              {copied ? (
                <Check size={14} className="text-green-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>

            {/* MON Balance */}
            {monBalance !== null && (
              <div className="flex items-center gap-1.5 mt-2">
                <Coins size={14} className="text-purple-400" />
                <span className="text-sm font-semibold text-white">
                  {parseFloat(monBalance).toFixed(4)}
                </span>
                <span className="text-xs text-gray-500">MON</span>
              </div>
            )}

            {user?.bio && (
              <p className="text-gray-400 mt-3 text-sm leading-relaxed">{user.bio}</p>
            )}

            {user?.createdAt && (
              <p className="text-sm text-gray-600 mt-2">
                Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="text-center" padding="md">
          <Trophy size={20} className="text-purple-400 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-white">{reputation?.bountiesCompleted || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Completed</p>
        </Card>
        <Card className="text-center" padding="md">
          <FileText size={20} className="text-blue-400 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-white">{reputation?.bountiesCreated || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Created</p>
        </Card>
        <Card className="text-center" padding="md">
          <Star size={20} className="text-green-400 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-white">
            {reputation?.totalEarned ? formatMON(reputation.totalEarned) : '0'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">MON Earned</p>
        </Card>
        <Card className="text-center" padding="md">
          <Star size={20} className="text-yellow-400 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-white">
            {reputation?.totalSpent ? formatMON(reputation.totalSpent) : '0'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">MON Spent</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1 gap-1 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center justify-center gap-1.5 flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
              tab === t.key
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.mobileLabel}</span>
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-white/20' : 'bg-gray-800'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {tab === 'posts' && (
          <>
            {posts.length === 0 ? (
              <EmptyState
                icon={<MessageSquare size={28} className="text-gray-600" />}
                title="No posts yet"
                description={isOwnProfile ? "You haven't posted anything yet." : "This user hasn't posted anything yet."}
              />
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </>
        )}

        {tab === 'created' && (
          <>
            {createdBounties.length === 0 ? (
              <EmptyState
                icon={<FileText size={28} className="text-gray-600" />}
                title="No bounties created"
                description={isOwnProfile ? "You haven't created any bounties yet." : "This user hasn't created any bounties yet."}
                action={isOwnProfile ? (
                  <Link href="/bounties/create">
                    <Button size="sm">Create a Bounty</Button>
                  </Link>
                ) : undefined}
              />
            ) : (
              createdBounties.map((bounty) => (
                <BountyListItem key={bounty.id} bounty={bounty} getStatusColor={getStatusColor} />
              ))
            )}
          </>
        )}

        {tab === 'completed' && (
          <>
            {completedBounties.length === 0 ? (
              <EmptyState
                icon={<Award size={28} className="text-gray-600" />}
                title="No bounties won"
                description={isOwnProfile ? "You haven't won any bounties yet. Start submitting!" : "This user hasn't won any bounties yet."}
                action={isOwnProfile ? (
                  <Link href="/bounties">
                    <Button size="sm">Browse Bounties</Button>
                  </Link>
                ) : undefined}
              />
            ) : (
              completedBounties.map((bounty) => (
                <BountyListItem key={bounty.id} bounty={bounty} getStatusColor={getStatusColor} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BountyListItem({ bounty, getStatusColor }: { bounty: any; getStatusColor: (s: string) => string }) {
  const daysLeft = Math.ceil(
    (new Date(bounty.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isExpired = daysLeft < 0;

  return (
    <Link href={`/bounties/${bounty.id}`}>
      <Card className="hover:border-gray-700 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-4">
            <h3 className="font-semibold text-white hover:text-purple-400 transition-colors truncate">
              {bounty.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(bounty.status)}`}>
                {bounty.status}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock size={12} />
                {isExpired ? 'Expired' : `${daysLeft}d left`}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <FileText size={12} />
                {bounty._count?.submissions || 0} submissions
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-purple-400">{formatMON(bounty.amount)}</p>
            <p className="text-xs text-gray-500">MON</p>
          </div>
        </div>

        {bounty.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {bounty.tags.slice(0, 4).map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-400 rounded-full">
                #{tag}
              </span>
            ))}
            {bounty.tags.length > 4 && (
              <span className="text-xs text-gray-500">+{bounty.tags.length - 4}</span>
            )}
          </div>
        )}
      </Card>
    </Link>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12">
      <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="text-gray-400 font-medium mb-1">{title}</p>
      <p className="text-gray-600 text-sm mb-4">{description}</p>
      {action}
    </div>
  );
}
