import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);
    const creatorAddress = searchParams.get('creator');
    const winnerAddress = searchParams.get('winner');

    // If filtering by winner, find the user first
    let winnerUserId: string | undefined;
    if (winnerAddress) {
      const winnerUser = await prisma.user.findUnique({
        where: { walletAddress: winnerAddress },
        select: { id: true },
      });
      winnerUserId = winnerUser?.id;
      if (!winnerUserId) {
        return NextResponse.json({ bounties: [], nextCursor: undefined });
      }
    }

    const bounties = await prisma.bounty.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(creatorAddress && {
          creator: { walletAddress: creatorAddress },
        }),
        ...(winnerUserId && {
          winners: { some: { submission: { contributorId: winnerUserId } } },
        }),
      },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        post: {
          select: { id: true, content: true },
        },
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { submissions: true },
        },
      },
    });

    let nextCursor: string | undefined;
    if (bounties.length > limit) {
      const nextItem = bounties.pop();
      nextCursor = nextItem?.id;
    }

    return NextResponse.json({ bounties, nextCursor });
  } catch (error) {
    console.error('GET /api/bounties error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bounties' },
      { status: 500 }
    );
  }
}
