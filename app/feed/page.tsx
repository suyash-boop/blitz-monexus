'use client';

import { useState, useEffect, useCallback } from 'react';
import { PostCard } from '@/components/posts/PostCard';
import { CreatePostModal } from '@/components/posts/CreatePostModal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { PenSquare, Flame, MessageSquare, Trophy, Sparkles, RefreshCw } from 'lucide-react';
import { getAvatarUrl } from '@/lib/utils';

type FilterType = 'all' | 'REGULAR' | 'BOUNTY';

const filters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All Posts', icon: <Flame size={15} /> },
  { key: 'REGULAR', label: 'Discussions', icon: <MessageSquare size={15} /> },
  { key: 'BOUNTY', label: 'Bounties', icon: <Trophy size={15} /> },
];

export default function FeedPage() {
  const { isConnected, walletAddress } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPosts = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter !== 'all') params.set('type', filter);

      const res = await fetch(`/api/posts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Compose box */}
      {isConnected && (
        <div className="glass rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <Avatar
              src={getAvatarUrl(walletAddress || '')}
              size="md"
              alt="Your avatar"
            />
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 text-left bg-white/[0.04] hover:bg-white/[0.06] border border-glass-border hover:border-glass-border-hover rounded-xl px-4 py-2.5 text-text-muted hover:text-text-secondary transition-all text-sm"
            >
              What&apos;s happening on Monad?
            </button>
            <Button onClick={() => setIsCreateModalOpen(true)} size="sm" className="rounded-xl">
              <PenSquare size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex glass rounded-xl p-1 gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                filter === f.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/[0.06]'
              }`}
            >
              {f.icon}
              <span className="hidden sm:inline">{f.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => fetchPosts(true)}
          disabled={isRefreshing}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-white/[0.06] rounded-lg transition-colors disabled:opacity-50"
          title="Refresh feed"
        >
          <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : posts.length > 0 ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-primary-text" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              {filter === 'all' ? 'No posts yet' : `No ${filter === 'BOUNTY' ? 'bounties' : 'discussions'} yet`}
            </h3>
            <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
              {isConnected
                ? 'Be the first to share something with the Monad community!'
                : 'Connect your wallet to start posting and engaging with the community.'}
            </p>
            {isConnected && (
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <PenSquare size={16} className="mr-2" />
                Create First Post
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => fetchPosts()}
      />
    </div>
  );
}
