import { NextResponse } from 'next/server';

// GET /api/predictions/price — fetch MON/USD price
export async function GET() {
  try {
    // Primary: CoinGecko API (free, no key needed, has accurate MON price)
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd&include_24hr_change=true',
        { next: { revalidate: 10 } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.monad?.usd) {
          return NextResponse.json({
            price: data.monad.usd,
            change24h: data.monad.usd_24h_change || 0,
            source: 'coingecko',
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      // fallthrough to DexScreener
    }

    // Fallback: DexScreener
    try {
      const res = await fetch(
        'https://api.dexscreener.com/latest/dex/search?q=MON%20USDT',
        { next: { revalidate: 10 } }
      );
      if (res.ok) {
        const data = await res.json();
        const pair = data.pairs?.find(
          (p: any) => p.chainId === 'monad' || p.baseToken?.symbol === 'MON'
        );
        if (pair?.priceUsd) {
          return NextResponse.json({
            price: parseFloat(pair.priceUsd),
            change24h: pair.priceChange?.h24 || 0,
            source: 'dexscreener',
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      // fallthrough to fallback
    }

    // Last resort fallback — should rarely happen
    return NextResponse.json({
      price: 0,
      change24h: 0,
      source: 'unavailable',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('GET /api/predictions/price error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price' },
      { status: 500 }
    );
  }
}
