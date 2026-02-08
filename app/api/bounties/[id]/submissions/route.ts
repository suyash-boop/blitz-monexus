import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ethers } from 'ethers';
import { BOUNTY_ESCROW_ABI, BOUNTY_ESCROW_ADDRESS } from '@/lib/contract';
import { MONAD_RPC_URL } from '@/config/chains';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bountyId } = await params;

    const submissions = await prisma.submission.findMany({
      where: { bountyId },
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
    });

    return NextResponse.json(submissions);
  } catch (error) {
    console.error('GET /api/bounties/[id]/submissions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bountyId } = await params;
    const { walletAddress, content, attachments, links } = await request.json();

    if (!walletAddress || !content) {
      return NextResponse.json(
        { error: 'walletAddress and content are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const bounty = await prisma.bounty.findUnique({
      where: { id: bountyId },
    });

    if (!bounty) {
      return NextResponse.json(
        { error: 'Bounty not found' },
        { status: 404 }
      );
    }

    if (bounty.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Bounty is not accepting submissions' },
        { status: 400 }
      );
    }

    if (bounty.creatorId === user.id) {
      return NextResponse.json(
        { error: 'Cannot submit to your own bounty' },
        { status: 400 }
      );
    }

    // Build full content with links appended
    const fullContent = links?.length
      ? `${content}\n\n---\nLinks:\n${links.map((l: string) => `- ${l}`).join('\n')}`
      : content;

    const submission = await prisma.submission.create({
      data: {
        bountyId,
        contributorId: user.id,
        content: fullContent,
        status: 'PENDING',
        ...(attachments?.length > 0 && {
          attachments: {
            create: attachments.map((a: { url: string; type: string; filename?: string }) => ({
              type: a.type as 'IMAGE' | 'VIDEO' | 'GIF',
              url: a.url,
              filename: a.filename || null,
            })),
          },
        }),
      },
      include: {
        contributor: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        attachments: true,
      },
    });

    // Register the submission on-chain so the contributor can be selected as a winner
    if (bounty.contractBountyId && process.env.DEPLOYER_PRIVATE_KEY) {
      try {
        const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
        const adminWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(BOUNTY_ESCROW_ADDRESS, BOUNTY_ESCROW_ABI, adminWallet);
        const tx = await contract.registerSubmission(
          parseInt(bounty.contractBountyId),
          walletAddress
        );
        await tx.wait();
        console.log(`Registered submission on-chain: bounty #${bounty.contractBountyId}, contributor ${walletAddress}`);
      } catch (chainErr) {
        console.error('Failed to register submission on-chain:', chainErr);
        // Submission is saved in DB; on-chain registration can be retried
      }
    }

    return NextResponse.json(submission, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'You have already submitted to this bounty' },
        { status: 409 }
      );
    }
    console.error('POST /api/bounties/[id]/submissions error:', error);
    return NextResponse.json(
      { error: 'Failed to create submission' },
      { status: 500 }
    );
  }
}
