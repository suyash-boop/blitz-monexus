'use client';

import Link from 'next/link';
import { Clock, Users, FileText, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { formatMON, formatAddress, getAvatarUrl } from '@/lib/utils';

interface BountyCardProps {
  bounty: {
    id: string;
    title: string;
    description: string;
    amount: string;
    status: 'DRAFT' | 'OPEN' | 'IN_REVIEW' | 'DISPUTED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
    deadline: Date;
    maxWinners: number;
    submissionCount: number;
    tags: string[];
    creator: {
      walletAddress: string;
      displayName?: string | null;
    };
  };
}

export function BountyCard({ bounty }: BountyCardProps) {
  const isExpired = new Date(bounty.deadline) < new Date();
  const daysLeft = Math.ceil(
    (new Date(bounty.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const getStatusBadge = () => {
    switch (bounty.status) {
      case 'OPEN':
        return <Badge variant="success">Open</Badge>;
      case 'IN_REVIEW':
        return <Badge variant="warning">In Review</Badge>;
      case 'COMPLETED':
        return <Badge variant="info">Completed</Badge>;
      case 'DISPUTED':
        return <Badge variant="danger">Disputed</Badge>;
      case 'CANCELLED':
        return <Badge variant="default">Cancelled</Badge>;
      case 'EXPIRED':
        return <Badge variant="default">Expired</Badge>;
      default:
        return <Badge variant="default">{bounty.status}</Badge>;
    }
  };

  return (
    <Link href={`/bounties/${bounty.id}`} className="block group">
      <Card className="transition-all card-hover">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getStatusBadge()}
              {bounty.maxWinners > 1 && (
                <Badge variant="purple" size="sm">
                  <Users size={12} className="mr-1" />
                  {bounty.maxWinners} winners
                </Badge>
              )}
            </div>
            <h3 className="text-lg font-semibold text-text-primary group-hover:text-primary-text transition-colors truncate">
              {bounty.title}
            </h3>
          </div>
          <div className="text-right ml-4 flex-shrink-0">
            <p className="text-2xl font-bold text-primary-text">
              {formatMON(bounty.amount)}
            </p>
            <p className="text-xs text-text-muted font-medium">MON</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-text-secondary text-sm mb-4 line-clamp-2 leading-relaxed">
          {bounty.description}
        </p>

        {/* Tags */}
        {bounty.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {bounty.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 text-xs bg-white/[0.04] text-text-secondary rounded-lg border border-glass-border hover:border-glass-border-hover transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-glass-border">
          <div className="flex items-center space-x-4 text-sm text-text-muted">
            <div className="flex items-center space-x-1.5">
              <Clock size={14} />
              <span>
                {isExpired ? 'Expired' : `${daysLeft}d left`}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <FileText size={14} />
              <span>{bounty.submissionCount} submissions</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm text-text-secondary">
              <Avatar
                src={getAvatarUrl(bounty.creator.walletAddress)}
                size="xs"
                alt={bounty.creator.displayName || bounty.creator.walletAddress}
              />
              <span className="hidden sm:inline">
                {bounty.creator.displayName || formatAddress(bounty.creator.walletAddress)}
              </span>
            </div>

            <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-text-secondary group-hover:bg-primary group-hover:text-white transition-all">
              <ArrowUpRight size={16} />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default BountyCard;
