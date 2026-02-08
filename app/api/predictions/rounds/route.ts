import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import {
  PREDICTION_GAME_ADDRESS,
  PREDICTION_GAME_ABI,
} from '@/lib/prediction-contract';

const ROUND_DURATION = 300; // 5 minutes in seconds
const LOCK_DURATION = 150;  // 2.5 minutes betting window

// Price scaled to 1e8 for the contract (int256)
function priceToContract(price: number): bigint {
  return BigInt(Math.round(price * 1e8));
}

async function fetchCurrentPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd',
      { next: { revalidate: 10 } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.monad?.usd) return data.monad.usd;
    }
  } catch { /* ignore */ }
  return 0.0184; // fallback
}

function getOperatorContract(): ethers.Contract | null {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  const rpc = process.env.NEXT_PUBLIC_MONAD_RPC_URL;
  if (!pk || !PREDICTION_GAME_ADDRESS) return null;
  try {
    const provider = new ethers.JsonRpcProvider(rpc || 'https://testnet-rpc.monad.xyz');
    const wallet = new ethers.Wallet(pk, provider);
    return new ethers.Contract(PREDICTION_GAME_ADDRESS, PREDICTION_GAME_ABI, wallet);
  } catch {
    return null;
  }
}

/**
 * Auto-manage rounds:
 * 1. Lock LIVE rounds whose lockTimestamp passed (DB only)
 * 2. If no active round, start a new round on-chain (which also locks the
 *    previous round — the contract requires this before resolveRound) and
 *    then resolve the previous round on-chain.
 * 3. Sync DB: mark expired rounds RESOLVED, create new round row.
 *
 * CONTRACT FLOW:
 *   startRound(price) → sets prev.lockPrice, creates next round
 *   resolveRound(epoch, closePrice) → requires lockPrice != 0
 *   So we MUST call startRound BEFORE resolveRound.
 */
async function autoManageRounds() {
  const now = new Date();
  const contract = getOperatorContract();
  const currentPrice = await fetchCurrentPrice();

  // 1. Lock LIVE rounds whose lockTimestamp has passed (DB status only)
  await prisma.predictionRound.updateMany({
    where: {
      status: 'LIVE',
      lockTimestamp: { lte: now },
      closeTimestamp: { gt: now },
    },
    data: { status: 'LOCKED' },
  });

  // 2. Check if there's still an active round
  const activeRound = await prisma.predictionRound.findFirst({
    where: {
      status: { in: ['LIVE', 'LOCKED'] },
      closeTimestamp: { gt: now },
    },
  });

  if (activeRound) return; // Round is still running, nothing to do

  // --- No active round: create a new one (and resolve the expired one) ---

  // Collect expired rounds from DB (to update later)
  const expiredRounds = await prisma.predictionRound.findMany({
    where: {
      status: { in: ['LIVE', 'LOCKED'] },
      closeTimestamp: { lte: now },
    },
  });

  let txHash: string | null = null;
  let newEpoch: number;
  let contractPrevEpoch = 0;

  if (contract) {
    try {
      // Read current epoch before starting new round
      contractPrevEpoch = Number(await contract.currentEpoch());

      // startRound: locks previous round (sets lockPrice) AND creates next round
      const tx = await contract.startRound(priceToContract(currentPrice));
      await tx.wait();
      txHash = tx.hash;

      newEpoch = Number(await contract.currentEpoch());
      console.log(
        `[Prediction] Started round #${newEpoch} on-chain (locked prev #${contractPrevEpoch}), tx: ${txHash}`
      );

      // Now resolve the previous round on-chain (lockPrice was just set by startRound)
      if (contractPrevEpoch > 0) {
        try {
          const resolveTx = await contract.resolveRound(
            contractPrevEpoch,
            priceToContract(currentPrice)
          );
          await resolveTx.wait();
          console.log(`[Prediction] Resolved round #${contractPrevEpoch} on-chain`);
        } catch (err: any) {
          // May already be resolved or cancelled — non-fatal
          console.error(
            `[Prediction] resolveRound #${contractPrevEpoch} failed:`,
            err.reason || err.message
          );
        }
      }
    } catch (err: any) {
      console.error('[Prediction] startRound failed:', err.reason || err.message);
      // Fallback: DB-only epoch
      const lastRound = await prisma.predictionRound.findFirst({ orderBy: { epoch: 'desc' } });
      newEpoch = (lastRound?.epoch ?? 0) + 1;
    }
  } else {
    const lastRound = await prisma.predictionRound.findFirst({ orderBy: { epoch: 'desc' } });
    newEpoch = (lastRound?.epoch ?? 0) + 1;
  }

  // 3a. Mark expired DB rounds as RESOLVED
  for (const round of expiredRounds) {
    await prisma.predictionRound.update({
      where: { id: round.id },
      data: {
        lockPrice: round.lockPrice || String(currentPrice),
        closePrice: String(currentPrice),
        status: 'RESOLVED',
      },
    });
  }

  // 3b. Create new round in DB
  const startTime = now;
  const lockTime = new Date(now.getTime() + LOCK_DURATION * 1000);
  const closeTime = new Date(now.getTime() + ROUND_DURATION * 1000);

  await prisma.predictionRound.create({
    data: {
      epoch: newEpoch!,
      startTimestamp: startTime,
      lockTimestamp: lockTime,
      closeTimestamp: closeTime,
      lockPrice: String(currentPrice),
      txHash,
      status: 'LIVE',
    },
  });
}

// GET /api/predictions/rounds — fetch recent rounds (auto-manages lifecycle)
export async function GET(request: NextRequest) {
  try {
    await autoManageRounds();

    const { searchParams } = request.nextUrl;
    const limit = Math.min(Number(searchParams.get('limit')) || 10, 50);

    const rounds = await prisma.predictionRound.findMany({
      take: limit,
      orderBy: { epoch: 'desc' },
      include: {
        _count: { select: { bets: true } },
      },
    });

    return NextResponse.json({ rounds });
  } catch (error) {
    console.error('GET /api/predictions/rounds error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rounds' },
      { status: 500 }
    );
  }
}

// POST /api/predictions/rounds — manually record a new round (admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epoch, txHash, startTimestamp, lockTimestamp, closeTimestamp, lockPrice } = body;

    if (!epoch || !startTimestamp || !lockTimestamp || !closeTimestamp) {
      return NextResponse.json(
        { error: 'epoch, startTimestamp, lockTimestamp, closeTimestamp are required' },
        { status: 400 }
      );
    }

    const round = await prisma.predictionRound.create({
      data: {
        epoch: Number(epoch),
        txHash: txHash || null,
        startTimestamp: new Date(startTimestamp * 1000),
        lockTimestamp: new Date(lockTimestamp * 1000),
        closeTimestamp: new Date(closeTimestamp * 1000),
        lockPrice: lockPrice ? String(lockPrice) : null,
        status: 'LIVE',
      },
    });

    return NextResponse.json({ round }, { status: 201 });
  } catch (error) {
    console.error('POST /api/predictions/rounds error:', error);
    return NextResponse.json(
      { error: 'Failed to create round' },
      { status: 500 }
    );
  }
}
