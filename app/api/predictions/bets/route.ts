import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/predictions/bets — record a bet
export async function POST(request: NextRequest) {
  try {
    const { epoch, walletAddress, position, amount, txHash } = await request.json();

    if (!epoch || !walletAddress || !position || !amount) {
      return NextResponse.json(
        { error: 'epoch, walletAddress, position, amount are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const round = await prisma.predictionRound.findUnique({ where: { epoch: Number(epoch) } });
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    const bet = await prisma.predictionBet.create({
      data: {
        roundId: round.id,
        userId: user.id,
        position: position as 'UP' | 'DOWN',
        amount: String(amount),
        txHash: txHash || null,
      },
    });

    // Update round totals
    const upKey = position === 'UP' ? 'upAmount' : 'downAmount';
    const currentAmount = position === 'UP'
      ? parseFloat(round.upAmount)
      : parseFloat(round.downAmount);
    const newAmount = currentAmount + parseFloat(String(amount));
    const newTotal = parseFloat(round.totalAmount) + parseFloat(String(amount));

    await prisma.predictionRound.update({
      where: { id: round.id },
      data: {
        [upKey]: String(newAmount),
        totalAmount: String(newTotal),
      },
    });

    return NextResponse.json({ bet }, { status: 201 });
  } catch (error) {
    console.error('POST /api/predictions/bets error:', error);
    return NextResponse.json(
      { error: 'Failed to record bet' },
      { status: 500 }
    );
  }
}

// PATCH /api/predictions/bets — mark a bet as claimed
export async function PATCH(request: NextRequest) {
  try {
    const { epoch, walletAddress, claimTxHash } = await request.json();

    if (!epoch || !walletAddress) {
      return NextResponse.json(
        { error: 'epoch and walletAddress are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const round = await prisma.predictionRound.findUnique({ where: { epoch: Number(epoch) } });
    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    const bet = await prisma.predictionBet.findUnique({
      where: { roundId_userId: { roundId: round.id, userId: user.id } },
    });

    if (!bet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }

    const updated = await prisma.predictionBet.update({
      where: { id: bet.id },
      data: {
        claimed: true,
        claimTxHash: claimTxHash || null,
      },
    });

    return NextResponse.json({ bet: updated });
  } catch (error) {
    console.error('PATCH /api/predictions/bets error:', error);
    return NextResponse.json(
      { error: 'Failed to update bet' },
      { status: 500 }
    );
  }
}

// GET /api/predictions/bets — get user's bet history
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    if (!wallet) {
      return NextResponse.json({ error: 'wallet is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { walletAddress: wallet } });
    if (!user) {
      return NextResponse.json({ bets: [] });
    }

    const bets = await prisma.predictionBet.findMany({
      where: { userId: user.id },
      include: { round: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ bets });
  } catch (error) {
    console.error('GET /api/predictions/bets error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bets' },
      { status: 500 }
    );
  }
}
