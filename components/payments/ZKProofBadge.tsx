'use client';

import { Shield, Zap, Lock, CheckCircle2 } from 'lucide-react';

interface ZKProofBadgeProps {
  /** Whether ZK proof is active/verified */
  verified?: boolean;
  /** Whether to show compact mode */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Badge showing ZK proof status
 * Appears on transactions that used zero-knowledge proofs
 */
export function ZKProofBadge({ verified, compact = false, className = '' }: ZKProofBadgeProps) {
  if (compact) {
    return (
      <span
        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
          verified
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
        } ${className}`}
      >
        <Shield className="h-2.5 w-2.5" />
        <span>ZK</span>
        {verified && <CheckCircle2 className="h-2.5 w-2.5" />}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg ${
        verified
          ? 'bg-green-500/10 border border-green-500/20'
          : 'bg-purple-500/10 border border-purple-500/20'
      } ${className}`}
    >
      <div className="relative">
        <Shield className={`h-4 w-4 ${verified ? 'text-green-400' : 'text-purple-400'}`} />
        {!verified && (
          <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-purple-500 rounded-full animate-pulse" />
        )}
      </div>
      <div className="flex flex-col">
        <span className={`text-xs font-medium ${verified ? 'text-green-300' : 'text-purple-300'}`}>
          {verified ? 'ZK Verified' : 'ZK Proof'}
        </span>
        <span className="text-[10px] text-gray-500">
          {verified ? 'Payment privately verified' : 'Zero-knowledge protected'}
        </span>
      </div>
      {verified && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
    </div>
  );
}

interface X402BadgeProps {
  /** Payment scheme */
  scheme?: 'exact' | 'zk-exact';
  /** Whether settled */
  settled?: boolean;
  /** Compact mode */
  compact?: boolean;
  className?: string;
}

/**
 * Badge showing x402 protocol status
 */
export function X402Badge({ scheme, settled, compact = false, className = '' }: X402BadgeProps) {
  if (compact) {
    return (
      <span
        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
          settled
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
        } ${className}`}
      >
        <Zap className="h-2.5 w-2.5" />
        <span>x402</span>
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg ${
        settled
          ? 'bg-blue-500/10 border border-blue-500/20'
          : 'bg-yellow-500/10 border border-yellow-500/20'
      } ${className}`}
    >
      <Zap className={`h-4 w-4 ${settled ? 'text-blue-400' : 'text-yellow-400'}`} />
      <div className="flex flex-col">
        <span className={`text-xs font-medium ${settled ? 'text-blue-300' : 'text-yellow-300'}`}>
          x402 {settled ? 'Settled' : 'Required'}
        </span>
        {scheme && (
          <span className="text-[10px] text-gray-500">
            {scheme === 'zk-exact' ? 'ZK-Exact scheme' : 'Exact scheme'}
          </span>
        )}
      </div>
      {settled && <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />}
    </div>
  );
}

export default ZKProofBadge;
