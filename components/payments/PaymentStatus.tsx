'use client';

import { Shield, Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';

interface PaymentStatusProps {
  status: 'idle' | 'creating-proof' | 'sending' | 'verifying' | 'settled' | 'error';
  txHash?: string;
  receipt?: string;
  error?: string;
  onReset?: () => void;
}

export function PaymentStatus({ status, txHash, receipt, error, onReset }: PaymentStatusProps) {
  if (status === 'idle') return null;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 backdrop-blur-sm">
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {status === 'creating-proof' && (
            <div className="relative">
              <Shield className="h-5 w-5 text-purple-400 animate-pulse" />
              <div className="absolute -top-1 -right-1 h-2 w-2 bg-purple-500 rounded-full animate-ping" />
            </div>
          )}
          {status === 'sending' && (
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
          )}
          {status === 'verifying' && (
            <div className="relative">
              <Zap className="h-5 w-5 text-yellow-400 animate-pulse" />
              <div className="absolute -top-1 -right-1 h-2 w-2 bg-yellow-500 rounded-full animate-ping" />
            </div>
          )}
          {status === 'settled' && (
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          )}
          {status === 'error' && (
            <XCircle className="h-5 w-5 text-red-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-white">
              {status === 'creating-proof' && 'Generating ZK Proof...'}
              {status === 'sending' && 'Sending Payment...'}
              {status === 'verifying' && 'Verifying x402 Payment...'}
              {status === 'settled' && 'Payment Settled ✓'}
              {status === 'error' && 'Payment Failed'}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
              x402
            </span>
          </div>

          <p className="text-xs text-gray-400 mt-1">
            {status === 'creating-proof' && 'Creating zero-knowledge proof for private payment verification...'}
            {status === 'sending' && 'Broadcasting signed payment to the network...'}
            {status === 'verifying' && 'Verifying ZK proof and settling payment on-chain...'}
            {status === 'settled' && 'Payment verified and settled successfully via x402 protocol.'}
            {status === 'error' && (error || 'An error occurred during payment processing.')}
          </p>

          {/* Transaction details */}
          {txHash && (
            <div className="mt-2 flex items-center space-x-2">
              <span className="text-xs text-gray-500">Tx:</span>
              <a
                href={`${process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || 'https://testnet.monadexplorer.com'}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 font-mono truncate max-w-[200px]"
              >
                {txHash}
              </a>
            </div>
          )}

          {receipt && (
            <div className="mt-1 flex items-center space-x-2">
              <span className="text-xs text-gray-500">Receipt:</span>
              <span className="text-xs text-gray-400 font-mono truncate max-w-[200px]">
                {receipt}
              </span>
            </div>
          )}
        </div>

        {/* Reset button */}
        {(status === 'settled' || status === 'error') && onReset && (
          <button
            onClick={onReset}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Progress bar */}
      {(status === 'creating-proof' || status === 'sending' || status === 'verifying') && (
        <div className="mt-3 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              status === 'creating-proof'
                ? 'w-1/3 bg-purple-500'
                : status === 'sending'
                ? 'w-2/3 bg-blue-500'
                : 'w-full bg-yellow-500'
            }`}
          />
        </div>
      )}
    </div>
  );
}

export default PaymentStatus;
