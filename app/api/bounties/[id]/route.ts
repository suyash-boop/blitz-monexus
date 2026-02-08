import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const bounty = await prisma.bounty.findUnique({
      where: { id },
      include: {
        post: {
          select: { id: true, content: true, createdAt: true },
        },
        creator: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            avatarUrl: true,
            reputation: true,
          },
        },
        submissions: {
          include: {
            contributor: {
              select: {
                id: true,
                walletAddress: true,
                displayName: true,
                avatarUrl: true,
                reputation: true,
              },
            },
            attachments: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        winners: {
          include: {
            submission: {
              include: {
                contributor: {
                  select: {
                    walletAddress: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { submissions: true },
        },
      },
    });

    if (!bounty) {
      return NextResponse.json(
        { error: 'Bounty not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(bounty);
  } catch (error) {
    console.error('GET /api/bounties/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bounty' },
      { status: 500 }
    );
  }
}
