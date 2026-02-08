'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface LivePriceDisplayProps {
  className?: string;
}

export function LivePriceDisplay({ className = '' }: LivePriceDisplayProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number>(0);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const priceRef = useRef<number | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch('/api/predictions/price');
        if (res.ok) {
          const data = await res.json();
          if (data.price === 0 && data.source === 'unavailable') return;

          setPrevPrice(priceRef.current);
          setPrice(data.price);
          setChange24h(data.change24h || 0);

          if (priceRef.current !== null && data.price !== priceRef.current) {
            setFlash(data.price > priceRef.current ? 'up' : 'down');
            setTimeout(() => setFlash(null), 1000);
          }
          priceRef.current = data.price;
        }
      } catch (err) {
        console.error('Failed to fetch price:', err);
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 10000);
    return () => clearInterval(interval);
  }, []);

  if (price === null) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-3 h-3 rounded-full bg-white/[0.1] animate-pulse" />
        <span className="text-sm text-text-muted">Loading price...</span>
      </div>
    );
  }

  const isUp24h = change24h > 0;

  return (
    <div className={`flex items-center gap-2 glass rounded-lg px-3 py-1.5 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${
        flash === 'up' ? 'bg-green-400' : flash === 'down' ? 'bg-red-400' : 'bg-green-400'
      } animate-pulse`} />
      <span className="text-xs text-text-secondary font-medium">MON/USD</span>
      <span className={`text-sm font-bold transition-colors duration-300 ${
        flash === 'up' ? 'text-green-400' : flash === 'down' ? 'text-red-400' : 'text-text-primary'
      }`}>
        ${price.toFixed(4)}
      </span>
      {change24h !== 0 && (
        <span className={`flex items-center gap-0.5 text-xs font-medium ${
          isUp24h ? 'text-green-400' : 'text-red-400'
        }`}>
          {isUp24h ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isUp24h ? '+' : ''}{change24h.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export default LivePriceDisplay;
