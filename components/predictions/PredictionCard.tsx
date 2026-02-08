'use client';

import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Clock, Trophy, Lock, Users } from 'lucide-react';
import { ethers } from 'ethers';

export interface RoundData {
  id: string;
  epoch: number;
  startTimestamp: string;
  lockTimestamp: string;
  closeTimestamp: string;
  lockPrice: string | null;
  closePrice: string | null;
  totalAmount: string;
  upAmount: string;
  downAmount: string;
  status: 'LIVE' | 'LOCKED' | 'RESOLVED' | 'CANCELLED';
  _count?: { bets: number };
}

interface PredictionCardProps {
  round: RoundData;
  type: 'past' | 'live' | 'next';
  currentPrice?: number;
  userBet?: { position: 'UP' | 'DOWN'; amount: string; claimed: boolean } | null;
  onBetUp?: () => void;
  onBetDown?: () => void;
  onClaim?: () => void;
  isClaimable?: boolean;
}

function useCountdown(target: string) {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    function update() {
      const now = Date.now();
      const end = new Date(target).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('00:00');
        setExpired(true);
        return;
      }

      setExpired(false);
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return { timeLeft, expired };
}

export function PredictionCard({
  round,
  type,
  currentPrice,
  userBet,
  onBetUp,
  onBetDown,
  onClaim,
  isClaimable,
}: PredictionCardProps) {
  const total = parseFloat(round.totalAmount);
  const upAmt = parseFloat(round.upAmount);
  const downAmt = parseFloat(round.downAmount);
  const upPct = total > 0 ? Math.round((upAmt / total) * 100) : 50;
  const downPct = 100 - upPct;

  const lockCountdown = useCountdown(round.lockTimestamp);
  const closeCountdown = useCountdown(round.closeTimestamp);

  // Resolved card
  if (type === 'past') {
    const lockP = round.lockPrice ? parseFloat(round.lockPrice) : 0;
    const closeP = round.closePrice ? parseFloat(round.closePrice) : 0;
    const wentUp = closeP > lockP;
    const isTie = closeP === lockP;
    const priceChange = lockP > 0 ? (((closeP - lockP) / lockP) * 100).toFixed(2) : '0.00';

    return (
      <div className={`w-72 flex-shrink-0 snap-center rounded-xl border p-4 transition-all ${
        round.status === 'CANCELLED'
          ? 'bg-white/[0.02] border-glass-border'
          : wentUp
          ? 'bg-surface backdrop-blur-xl border-green-500/30'
          : 'bg-surface backdrop-blur-xl border-red-500/30'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-muted font-medium">#{round.epoch}</span>
          {round.status === 'CANCELLED' ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-text-secondary">Cancelled</span>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              wentUp ? 'bg-green-500/20 text-green-400' : isTie ? 'bg-white/[0.06] text-text-secondary' : 'bg-red-500/20 text-red-400'
            }`}>
              {isTie ? 'TIE' : wentUp ? 'UP' : 'DOWN'}
              {!isTie && ` ${priceChange}%`}
            </span>
          )}
        </div>

        {/* Result icon */}
        <div className="flex justify-center mb-3">
          {round.status === 'CANCELLED' ? (
            <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center">
              <Lock size={18} className="text-text-muted" />
            </div>
          ) : wentUp ? (
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <ArrowUp size={18} className="text-green-400" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <ArrowDown size={18} className="text-red-400" />
            </div>
          )}
        </div>

        {/* Prices */}
        {round.status !== 'CANCELLED' && (
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Locked</span>
              <span className="text-text-secondary">${lockP.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Closed</span>
              <span className={wentUp ? 'text-green-400' : 'text-red-400'}>${closeP.toFixed(4)}</span>
            </div>
          </div>
        )}

        {/* Pool */}
        <div className="flex justify-between text-xs mb-2">
          <span className="text-text-muted">Prize Pool</span>
          <span className="text-text-primary font-medium">{total.toFixed(2)} MON</span>
        </div>

        {/* UP/DOWN bar */}
        <div className="h-1.5 rounded-full bg-white/[0.06] flex overflow-hidden mb-3">
          <div className="bg-green-500 transition-all" style={{ width: `${upPct}%` }} />
          <div className="bg-red-500 transition-all" style={{ width: `${downPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>UP {upPct}%</span>
          <span>{downPct}% DOWN</span>
        </div>

        {/* User bet indicator & claim */}
        {userBet && (
          <div className="mt-3 pt-3 border-t border-glass-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">Your bet: {userBet.position}</span>
              <span className="text-text-primary">{parseFloat(userBet.amount).toFixed(2)} MON</span>
            </div>
            {isClaimable && !userBet.claimed && (
              <button
                onClick={onClaim}
                className="w-full mt-2 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Trophy size={12} />
                Claim Winnings
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Live card
  if (type === 'live') {
    const isLocked = lockCountdown.expired;
    const lockPriceVal = round.lockPrice ? parseFloat(round.lockPrice) : null;

    return (
      <div className="w-72 flex-shrink-0 snap-center rounded-xl border-2 border-primary/50 bg-surface backdrop-blur-xl p-4 shadow-lg shadow-primary/10 relative overflow-hidden">
        {/* Subtle animated background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary font-medium">#{round.epoch}</span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-semibold text-green-400">LIVE</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Clock size={12} className="text-primary-text" />
              <span className={`font-mono font-bold ${
                isLocked ? 'text-orange-400' : 'text-primary-text'
              }`}>
                {isLocked ? closeCountdown.timeLeft : lockCountdown.timeLeft}
              </span>
            </div>
          </div>

          {/* Status label */}
          <div className="text-center mb-3">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              isLocked
                ? 'bg-orange-500/20 text-orange-400'
                : 'bg-green-500/20 text-green-400'
            }`}>
              {isLocked ? 'LOCKED — Waiting for result' : 'OPEN — Place your bets!'}
            </span>
          </div>

          {/* Prices */}
          <div className="space-y-1.5 mb-3">
            {lockPriceVal && (
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Lock Price</span>
                <span className="text-text-secondary">${lockPriceVal.toFixed(4)}</span>
              </div>
            )}
            {currentPrice && (
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Current</span>
                <span className={`font-medium ${
                  lockPriceVal && currentPrice > lockPriceVal ? 'text-green-400' : 'text-red-400'
                }`}>
                  ${currentPrice.toFixed(4)}
                </span>
              </div>
            )}
          </div>

          {/* Pool info */}
          <div className="flex justify-between text-xs mb-2">
            <span className="text-text-muted">Prize Pool</span>
            <span className="text-text-primary font-medium">{total.toFixed(2)} MON</span>
          </div>

          {/* UP/DOWN bar */}
          <div className="h-2 rounded-full bg-white/[0.06] flex overflow-hidden mb-1">
            <div className="bg-green-500 transition-all duration-500" style={{ width: `${upPct}%` }} />
            <div className="bg-red-500 transition-all duration-500" style={{ width: `${downPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mb-3">
            <span>UP {upPct}%</span>
            <span>{downPct}% DOWN</span>
          </div>

          {/* Bet buttons or user bet */}
          {userBet ? (
            <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
              <span className="text-xs text-text-secondary">You bet </span>
              <span className={`text-xs font-bold ${
                userBet.position === 'UP' ? 'text-green-400' : 'text-red-400'
              }`}>
                {userBet.position}
              </span>
              <span className="text-xs text-text-secondary"> — {parseFloat(userBet.amount).toFixed(2)} MON</span>
            </div>
          ) : !isLocked ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onBetUp}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-lg text-sm font-semibold transition-colors"
              >
                <ArrowUp size={16} />
                UP
              </button>
              <button
                onClick={onBetDown}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg text-sm font-semibold transition-colors"
              >
                <ArrowDown size={16} />
                DOWN
              </button>
            </div>
          ) : (
            <div className="bg-white/[0.04] rounded-lg p-2.5 text-center">
              <span className="text-xs text-text-muted">Betting is closed</span>
            </div>
          )}

          {/* Participants */}
          {round._count && (
            <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-text-muted">
              <Users size={10} />
              {round._count.bets} participant{round._count.bets !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Next/upcoming card
  return (
    <div className="w-72 flex-shrink-0 snap-center rounded-xl border border-glass-border bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-faint font-medium">Next</span>
        <span className="text-xs text-text-faint">
          <Clock size={10} className="inline mr-1" />
          Soon
        </span>
      </div>

      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mb-3">
          <Lock size={20} className="text-text-faint" />
        </div>
        <p className="text-sm text-text-faint font-medium">Starting Soon</p>
        <p className="text-xs text-text-faint mt-1">Waiting for current round</p>
      </div>

      {/* Placeholder bar */}
      <div className="h-1.5 rounded-full bg-white/[0.04] mb-1" />
      <div className="flex justify-between text-[10px] text-text-faint">
        <span>UP —%</span>
        <span>—% DOWN</span>
      </div>
    </div>
  );
}

export default PredictionCard;
