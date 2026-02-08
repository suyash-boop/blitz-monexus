'use client';

import { useRef, useEffect } from 'react';
import { PredictionCard, RoundData } from './PredictionCard';

interface PredictionCarouselProps {
  rounds: RoundData[];
  liveEpoch: number | null;
  currentPrice?: number;
  userBets: Record<number, { position: 'UP' | 'DOWN'; amount: string; claimed: boolean }>;
  claimableEpochs: Set<number>;
  onBetUp: (epoch: number) => void;
  onBetDown: (epoch: number) => void;
  onClaim: (epoch: number) => void;
}

export function PredictionCarousel({
  rounds,
  liveEpoch,
  currentPrice,
  userBets,
  claimableEpochs,
  onBetUp,
  onBetDown,
  onClaim,
}: PredictionCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveCardRef = useRef<HTMLDivElement>(null);

  // Sort rounds by epoch ascending for display
  const sortedRounds = [...rounds].sort((a, b) => a.epoch - b.epoch);

  // Auto-scroll to live card on mount
  useEffect(() => {
    setTimeout(() => {
      if (liveCardRef.current) {
        liveCardRef.current.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }, 100);
  }, [liveEpoch]);

  if (sortedRounds.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/[0.06] flex items-center justify-center">
            <span className="text-2xl text-text-faint">?</span>
          </div>
          <p className="text-text-secondary font-medium">No rounds yet</p>
          <p className="text-sm text-text-faint mt-1">Waiting for the first prediction round to start</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Gradient edges for scroll hint */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a0a0f] to-transparent z-10 pointer-events-none" />

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 px-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {sortedRounds.map((round) => {
          const isLive = round.epoch === liveEpoch;
          const isPast = round.status === 'RESOLVED' || round.status === 'CANCELLED';
          const type = isLive ? 'live' : isPast ? 'past' : 'next';

          return (
            <div
              key={round.epoch}
              ref={isLive ? liveCardRef : undefined}
            >
              <PredictionCard
                round={round}
                type={type}
                currentPrice={isLive ? currentPrice : undefined}
                userBet={userBets[round.epoch] || null}
                isClaimable={claimableEpochs.has(round.epoch)}
                onBetUp={() => onBetUp(round.epoch)}
                onBetDown={() => onBetDown(round.epoch)}
                onClaim={() => onClaim(round.epoch)}
              />
            </div>
          );
        })}

        {/* Placeholder next cards */}
        {[1, 2].map((i) => (
          <div key={`next-${i}`}>
            <PredictionCard
              round={{
                id: `next-${i}`,
                epoch: (liveEpoch || 0) + i,
                startTimestamp: '',
                lockTimestamp: '',
                closeTimestamp: '',
                lockPrice: null,
                closePrice: null,
                totalAmount: '0',
                upAmount: '0',
                downAmount: '0',
                status: 'LIVE',
              }}
              type="next"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default PredictionCarousel;
