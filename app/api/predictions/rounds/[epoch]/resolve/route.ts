import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/predictions/rounds/[epoch]/resolve — resolve a round
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ epoch: string }> }
) {
  try {
    const { epoch: epochStr } = await params;
    const epochNum = parseInt(epochStr, 10);
    const { closePrice, lockPrice, resolveTxHash } = await request.json();

    if (!closePrice) {
      return NextResponse.json(
        { error: 'closePrice is required' },
        { status: 400 }
      );
    }

    const round = await prisma.predictionRound.update({
      where: { epoch: epochNum },
      data: {
        closePrice: String(closePrice),
        ...(lockPrice ? { lockPrice: String(lockPrice) } : {}),
        resolveTxHash: resolveTxHash || null,
        status: 'RESOLVED',
      },
    });

    return NextResponse.json({ round });
  } catch (error) {
    console.error('POST /api/predictions/rounds/[epoch]/resolve error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve round' },
      { status: 500 }
    );
  }
}
