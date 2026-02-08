'use client';

import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Trophy, Clock, Minus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface BetWithRound {
  id: string;
  position: 'UP' | 'DOWN';
  amount: string;
  claimed: boolean;
  reward: string | null;
  createdAt: string;
  round: {
    epoch: number;
    status: 'LIVE' | 'LOCKED' | 'RESOLVED' | 'CANCELLED';
    lockPrice: string | null;
    closePrice: string | null;
  };
}

interface PredictionHistoryProps {
  onClaim: (epoch: number) => void;
  refreshKey?: number;
}

export function PredictionHistory({ onClaim, refreshKey }: PredictionHistoryProps) {
  const { walletAddress, isConnected } = useAuth();
  const [bets, setBets] = useState<BetWithRound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setLoading(false);
      return;
    }

    async function fetchBets() {
      try {
        const res = await fetch(`/api/predictions/bets?wallet=${walletAddress}`);
        if (res.ok) {
          const data = await res.json();
          setBets(data.bets);
        }
      } catch (err) {
        console.error('Failed to fetch bet history:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchBets();
  }, [isConnected, walletAddress, refreshKey]);

  if (!isConnected) return null;

  if (loading) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Your Prediction History</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-white/[0.06] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Your Prediction History</h3>
        <div className="text-center py-8">
          <Clock size={24} className="text-text-faint mx-auto mb-2" />
          <p className="text-sm text-text-muted">No predictions yet</p>
          <p className="text-xs text-text-faint mt-1">Place a bet on a live round to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Your Prediction History</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border">
              <th className="text-left text-text-muted font-medium pb-3 pr-4">Round</th>
              <th className="text-left text-text-muted font-medium pb-3 pr-4">Position</th>
              <th className="text-right text-text-muted font-medium pb-3 pr-4">Amount</th>
              <th className="text-center text-text-muted font-medium pb-3 pr-4">Result</th>
              <th className="text-right text-text-muted font-medium pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet) => {
              const lockP = bet.round.lockPrice ? parseFloat(bet.round.lockPrice) : 0;
              const closeP = bet.round.closePrice ? parseFloat(bet.round.closePrice) : 0;
              const resolved = bet.round.status === 'RESOLVED';
              const wentUp = closeP > lockP;
              const isTie = closeP === lockP;
              const won = resolved && !isTie && (
                (wentUp && bet.position === 'UP') || (!wentUp && bet.position === 'DOWN')
              );
              const lost = resolved && !isTie && !won;

              return (
                <tr key={bet.id} className="border-b border-glass-border last:border-0">
                  <td className="py-3 pr-4">
                    <span className="text-text-secondary font-medium">#{bet.round.epoch}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5">
                      {bet.position === 'UP' ? (
                        <ArrowUp size={14} className="text-green-400" />
                      ) : (
                        <ArrowDown size={14} className="text-red-400" />
                      )}
                      <span className={bet.position === 'UP' ? 'text-green-400' : 'text-red-400'}>
                        {bet.position}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="text-text-secondary">{parseFloat(bet.amount).toFixed(2)} MON</span>
                  </td>
                  <td className="py-3 pr-4 text-center">
                    {!resolved ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        Pending
                      </span>
                    ) : won ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                        Won
                      </span>
                    ) : isTie ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-text-secondary">
                        Tie
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                        Lost
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {won && !bet.claimed ? (
                      <button
                        onClick={() => onClaim(bet.round.epoch)}
                        className="text-xs px-3 py-1 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Trophy size={10} />
                        Claim
                      </button>
                    ) : bet.claimed ? (
                      <span className="text-xs text-green-400">Claimed</span>
                    ) : lost ? (
                      <Minus size={14} className="text-text-faint ml-auto" />
                    ) : (
                      <span className="text-xs text-text-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PredictionHistory;
