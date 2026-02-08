'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown, X, Loader2 } from 'lucide-react';

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: 'UP' | 'DOWN';
  epoch: number;
  onConfirm: (amount: string) => Promise<void>;
  txStatus: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  txHash?: string;
  txError?: string;
  poolInfo: {
    total: number;
    upAmount: number;
    downAmount: number;
  };
}

const QUICK_AMOUNTS = ['0.1', '0.5', '1.0', '5.0'];

export function BetModal({
  isOpen,
  onClose,
  position,
  epoch,
  onConfirm,
  txStatus,
  txHash,
  txError,
  poolInfo,
}: BetModalProps) {
  const [amount, setAmount] = useState('');

  if (!isOpen) return null;

  const isUp = position === 'UP';
  const amountNum = parseFloat(amount) || 0;

  // Calculate approximate payout multiplier
  const currentSide = isUp ? poolInfo.upAmount : poolInfo.downAmount;
  const newTotal = poolInfo.total + amountNum;
  const newSide = currentSide + amountNum;
  const multiplier = newSide > 0 ? ((newTotal * 0.97) / newSide).toFixed(2) : '—';

  const isProcessing = txStatus === 'pending' || txStatus === 'confirming';

  async function handleSubmit() {
    if (amountNum < 0.01 || isProcessing) return;
    await onConfirm(amount);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm glass rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-glass-border ${
          isUp ? 'bg-green-500/5' : 'bg-red-500/5'
        }`}>
          <div className="flex items-center gap-2">
            {isUp ? (
              <ArrowUp size={18} className="text-green-400" />
            ) : (
              <ArrowDown size={18} className="text-red-400" />
            )}
            <h3 className="text-text-primary font-semibold">
              Bet {position} on Round #{epoch}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Amount input */}
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Amount (MON)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-white/[0.06] border border-glass-border rounded-lg text-text-primary text-lg font-medium placeholder-text-faint focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
            />
            <p className="text-[10px] text-text-faint mt-1">Min: 0.01 MON</p>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map((qa) => (
              <button
                key={qa}
                onClick={() => setAmount(qa)}
                disabled={isProcessing}
                className="flex-1 py-1.5 bg-white/[0.06] hover:bg-white/[0.08] border border-glass-border rounded-lg text-sm text-text-secondary font-medium transition-colors disabled:opacity-50"
              >
                {qa}
              </button>
            ))}
          </div>

          {/* Info */}
          <div className="bg-white/[0.04] rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Direction</span>
              <span className={isUp ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                {position}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Current Pool</span>
              <span className="text-text-secondary">{poolInfo.total.toFixed(2)} MON</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Payout (approx.)</span>
              <span className="text-primary-text font-medium">~{multiplier}x</span>
            </div>
          </div>

          {/* Transaction status */}
          {txStatus === 'pending' && (
            <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-2">
              <Loader2 size={14} className="animate-spin" />
              Confirm in your wallet...
            </div>
          )}
          {txStatus === 'confirming' && (
            <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 rounded-lg px-3 py-2">
              <Loader2 size={14} className="animate-spin" />
              Confirming transaction...
            </div>
          )}
          {txStatus === 'success' && (
            <div className="text-xs text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
              Bet placed successfully!
            </div>
          )}
          {txStatus === 'error' && (
            <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              {txError || 'Transaction failed'}
            </div>
          )}

          {/* Submit button */}
          {txStatus !== 'success' ? (
            <button
              onClick={handleSubmit}
              disabled={amountNum < 0.01 || isProcessing}
              className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isUp
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isProcessing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isUp ? (
                <ArrowUp size={16} />
              ) : (
                <ArrowDown size={16} />
              )}
              {isProcessing ? 'Processing...' : `Place ${position} Bet`}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-lg font-semibold text-sm bg-white/[0.06] hover:bg-white/[0.08] text-text-primary transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BetModal;
