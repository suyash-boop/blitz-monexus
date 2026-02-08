'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, Trophy, Coins, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePrediction } from '@/hooks/usePrediction';
import { LivePriceDisplay } from '@/components/predictions/LivePriceDisplay';
import { PredictionCarousel } from '@/components/predictions/PredictionCarousel';
import { PredictionHistory } from '@/components/predictions/PredictionHistory';
import { BetModal } from '@/components/predictions/BetModal';
import { RoundData } from '@/components/predictions/PredictionCard';

export default function PredictionsPage() {
  const { isConnected, walletAddress } = useAuth();
  const { betUp, betDown, claimWinnings, txState, resetTxState } = usePrediction();

  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(undefined);
  const [userBets, setUserBets] = useState<Record<number, { position: 'UP' | 'DOWN'; amount: string; claimed: boolean }>>({});
  const [claimableEpochs, setClaimableEpochs] = useState<Set<number>>(new Set());
  const [historyKey, setHistoryKey] = useState(0);

  // Bet modal state
  const [betModal, setBetModal] = useState<{
    isOpen: boolean;
    position: 'UP' | 'DOWN';
    epoch: number;
  }>({ isOpen: false, position: 'UP', epoch: 0 });

  // Find current live round
  const liveRound = rounds.find((r) => r.status === 'LIVE' || r.status === 'LOCKED');
  const liveEpoch = liveRound?.epoch ?? null;

  // Fetch rounds
  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch('/api/predictions/rounds?limit=20');
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds);
      }
    } catch (err) {
      console.error('Failed to fetch rounds:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch current price
  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/predictions/price');
      if (res.ok) {
        const data = await res.json();
        setCurrentPrice(data.price);
      }
    } catch (err) {
      console.error('Failed to fetch price:', err);
    }
  }, []);

  // Fetch user bets
  const fetchUserBets = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/predictions/bets?wallet=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        const betsMap: Record<number, { position: 'UP' | 'DOWN'; amount: string; claimed: boolean }> = {};
        for (const bet of data.bets) {
          betsMap[bet.round.epoch] = {
            position: bet.position,
            amount: bet.amount,
            claimed: bet.claimed,
          };
        }
        setUserBets(betsMap);
      }
    } catch (err) {
      console.error('Failed to fetch user bets:', err);
    }
  }, [walletAddress]);

  // Initial fetch and polling
  useEffect(() => {
    fetchRounds();
    fetchPrice();

    const roundsInterval = setInterval(fetchRounds, 15000);
    const priceInterval = setInterval(fetchPrice, 10000);

    return () => {
      clearInterval(roundsInterval);
      clearInterval(priceInterval);
    };
  }, [fetchRounds, fetchPrice]);

  useEffect(() => {
    if (isConnected && walletAddress) {
      fetchUserBets();
    }
  }, [isConnected, walletAddress, fetchUserBets]);

  // Handle bet
  async function handleBet(amount: string) {
    if (!liveEpoch) return;
    const epoch = betModal.epoch;
    try {
      if (betModal.position === 'UP') {
        await betUp(epoch, amount);
      } else {
        await betDown(epoch, amount);
      }

      // Record bet in DB
      await fetch('/api/predictions/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epoch,
          walletAddress,
          position: betModal.position,
          amount,
        }),
      });

      // Refresh data
      fetchRounds();
      fetchUserBets();
    } catch (err) {
      console.error('Bet failed:', err);
    }
  }

  // Handle claim
  async function handleClaim(epoch: number) {
    try {
      const txHash = await claimWinnings(epoch);

      // Mark bet as claimed in DB
      await fetch('/api/predictions/bets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epoch,
          walletAddress,
          claimTxHash: txHash,
        }),
      });

      fetchUserBets();
      fetchRounds();
      setHistoryKey((k) => k + 1);
    } catch (err) {
      console.error('Claim failed:', err);
    }
  }

  // Stats
  const totalBets = Object.keys(userBets).length;
  const resolvedBets = Object.entries(userBets).filter(([epoch]) => {
    const round = rounds.find((r) => r.epoch === Number(epoch));
    return round?.status === 'RESOLVED';
  });
  const wonBets = resolvedBets.filter(([epoch, bet]) => {
    const round = rounds.find((r) => r.epoch === Number(epoch));
    if (!round?.lockPrice || !round?.closePrice) return false;
    const lockP = parseFloat(round.lockPrice);
    const closeP = parseFloat(round.closePrice);
    const wentUp = closeP > lockP;
    return (wentUp && bet.position === 'UP') || (!wentUp && bet.position === 'DOWN');
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 lg:ml-64 mb-20 lg:mb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <TrendingUp className="text-primary-text" />
            Predictions
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Predict if MON price goes UP or DOWN in 5-minute rounds
          </p>
        </div>
        <LivePriceDisplay />
      </div>

      {/* Stats */}
      {isConnected && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="glass rounded-xl p-4 group transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={16} className="text-primary-text" />
              <span className="text-xs text-text-muted">Rounds Played</span>
            </div>
            <p className="text-xl font-bold text-text-primary">{totalBets}</p>
          </div>
          <div className="glass rounded-xl p-4 group transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={16} className="text-yellow-400" />
              <span className="text-xs text-text-muted">Won</span>
            </div>
            <p className="text-xl font-bold text-text-primary">{wonBets.length}</p>
          </div>
          <div className="glass rounded-xl p-4 group transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Coins size={16} className="text-green-400" />
              <span className="text-xs text-text-muted">Win Rate</span>
            </div>
            <p className="text-xl font-bold text-text-primary">
              {resolvedBets.length > 0
                ? Math.round((wonBets.length / resolvedBets.length) * 100)
                : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Carousel */}
      <div className="mb-8">
        {loading ? (
          <div className="flex gap-4 overflow-hidden px-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-72 flex-shrink-0 h-64 glass rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <PredictionCarousel
            rounds={rounds}
            liveEpoch={liveEpoch}
            currentPrice={currentPrice}
            userBets={userBets}
            claimableEpochs={claimableEpochs}
            onBetUp={(epoch) => {
              resetTxState();
              setBetModal({ isOpen: true, position: 'UP', epoch });
            }}
            onBetDown={(epoch) => {
              resetTxState();
              setBetModal({ isOpen: true, position: 'DOWN', epoch });
            }}
            onClaim={handleClaim}
          />
        )}
      </div>

      {/* History */}
      <PredictionHistory onClaim={handleClaim} refreshKey={historyKey} />

      {/* Bet Modal */}
      <BetModal
        isOpen={betModal.isOpen}
        onClose={() => {
          setBetModal({ ...betModal, isOpen: false });
          resetTxState();
        }}
        position={betModal.position}
        epoch={betModal.epoch}
        onConfirm={handleBet}
        txStatus={txState.status}
        txHash={txState.hash}
        txError={txState.error}
        poolInfo={{
          total: liveRound ? parseFloat(liveRound.totalAmount) : 0,
          upAmount: liveRound ? parseFloat(liveRound.upAmount) : 0,
          downAmount: liveRound ? parseFloat(liveRound.downAmount) : 0,
        }}
      />
    </div>
  );
}
