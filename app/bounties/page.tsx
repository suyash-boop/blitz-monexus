'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BountyCard } from '@/components/bounties/BountyCard';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { PlusCircle, Search, Trophy, Coins, FileText, Sparkles } from 'lucide-react';

const statusOptions = ['all', 'OPEN', 'IN_REVIEW', 'COMPLETED'] as const;
type StatusFilter = typeof statusOptions[number];

const statusLabels: Record<StatusFilter, string> = {
  all: 'All',
  OPEN: 'Open',
  IN_REVIEW: 'In Review',
  COMPLETED: 'Completed',
};

export default function BountiesPage() {
  const { isConnected } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [bounties, setBounties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBounties = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/bounties?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBounties(data.bounties || []);
      }
    } catch (err) {
      console.error('Failed to fetch bounties:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBounties();
  }, [fetchBounties]);

  const filteredBounties = bounties.filter((bounty) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      bounty.title.toLowerCase().includes(query) ||
      bounty.description.toLowerCase().includes(query) ||
      (bounty.tags || []).some((tag: string) => tag.toLowerCase().includes(query))
    );
  });

  const mappedBounties = filteredBounties.map((b: any) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    amount: b.amount,
    status: b.status,
    deadline: b.deadline,
    maxWinners: b.maxWinners,
    submissionCount: b._count?.submissions ?? 0,
    tags: b.tags || [],
    creator: {
      walletAddress: b.creator?.walletAddress || '',
      displayName: b.creator?.displayName || null,
    },
  }));

  const openCount = bounties.filter((b) => b.status === 'OPEN').length;
  const totalValue = bounties.reduce(
    (sum, b) => sum + parseFloat(b.amount || '0'),
    0
  );
  const totalSubmissions = bounties.reduce(
    (sum, b) => sum + (b._count?.submissions ?? 0),
    0
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Bounties</h1>
          <p className="text-text-muted mt-1">Find work, earn MON</p>
        </div>
        {isConnected && (
          <Link href="/bounties/create">
            <Button className="group">
              <PlusCircle size={18} className="mr-2" />
              Create Bounty
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="glass rounded-2xl p-5 card-hover">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Trophy size={18} className="text-green-400" />
            </div>
            <p className="text-sm text-text-secondary">Open</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{openCount}</p>
        </div>
        <div className="glass rounded-2xl p-5 card-hover">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-primary-soft rounded-lg flex items-center justify-center">
              <Coins size={18} className="text-primary-text" />
            </div>
            <p className="text-sm text-text-secondary">Total Value</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {totalValue > 0 ? totalValue.toFixed(0) : '0'} <span className="text-sm text-text-muted font-normal">MON</span>
          </p>
        </div>
        <div className="glass rounded-2xl p-5 card-hover">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <FileText size={18} className="text-blue-400" />
            </div>
            <p className="text-sm text-text-secondary">Submissions</p>
          </div>
          <p className="text-2xl font-bold text-text-primary">{totalSubmissions}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search bounties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-inset border border-glass-border rounded-xl text-text-primary placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>
        <div className="flex glass rounded-xl p-1 gap-1">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
                statusFilter === status
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.06]'
              }`}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>
      </div>

      {/* Bounty List */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : mappedBounties.length > 0 ? (
          mappedBounties.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} />
          ))
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-primary-text" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No bounties found</h3>
            <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
              {searchQuery
                ? `No results for "${searchQuery}". Try a different search.`
                : 'Be the first to create a bounty for the community!'}
            </p>
            {isConnected && !searchQuery && (
              <Link href="/bounties/create">
                <Button>
                  <PlusCircle size={16} className="mr-2" />
                  Create the first bounty
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
