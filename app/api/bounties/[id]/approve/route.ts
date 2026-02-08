import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bountyId } = await params;
    const { walletAddress, submissionId, txHash } = await request.json();

    if (!walletAddress || !submissionId) {
      return NextResponse.json(
        { error: 'walletAddress and submissionId are required' },
        { status: 400 }
      );
    }

    const creator = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!creator) {
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

    if (bounty.creatorId !== creator.id) {
      return NextResponse.json(
        { error: 'Only the bounty creator can approve submissions' },
        { status: 403 }
      );
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { contributor: true },
    });

    if (!submission || submission.bountyId !== bountyId) {
      return NextResponse.json(
        { error: 'Submission not found for this bounty' },
        { status: 404 }
      );
    }

    // Run everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update submission status
      const updatedSubmission = await tx.submission.update({
        where: { id: submissionId },
        data: { status: 'APPROVED' },
      });

      // Update bounty status
      const updatedBounty = await tx.bounty.update({
        where: { id: bountyId },
        data: {
          status: 'COMPLETED',
          ...(txHash && { txHash }),
        },
      });

      // Create winner record
      await tx.bountyWinner.create({
        data: {
          bountyId,
          submissionId,
          amount: bounty.amount,
          percentage: 100,
          txHash: txHash || null,
          paidAt: txHash ? new Date() : null,
        },
      });

      // Update contributor reputation
      await tx.reputation.upsert({
        where: { userId: submission.contributorId },
        create: {
          userId: submission.contributorId,
          bountiesCompleted: 1,
          totalEarned: bounty.amount,
        },
        update: {
          bountiesCompleted: { increment: 1 },
          totalEarned: String(
            parseFloat(
              (await tx.reputation.findUnique({
                where: { userId: submission.contributorId },
              }))?.totalEarned || '0'
            ) + parseFloat(bounty.amount)
          ),
        },
      });

      // Update creator reputation
      await tx.reputation.upsert({
        where: { userId: creator.id },
        create: {
          userId: creator.id,
          bountiesCreated: 1,
          totalSpent: bounty.amount,
        },
        update: {
          bountiesCreated: { increment: 1 },
          totalSpent: String(
            parseFloat(
              (await tx.reputation.findUnique({
                where: { userId: creator.id },
              }))?.totalSpent || '0'
            ) + parseFloat(bounty.amount)
          ),
        },
      });

      // Reject other pending submissions
      await tx.submission.updateMany({
        where: {
          bountyId,
          id: { not: submissionId },
          status: 'PENDING',
        },
        data: { status: 'REJECTED' },
      });

      return { bounty: updatedBounty, submission: updatedSubmission };
    });

    // Create BOUNTY_WON notification for the winner
    try {
      await prisma.notification.create({
        data: {
          type: 'BOUNTY_WON',
          message: `You won "${bounty.title}" and earned ${bounty.amount} MON!`,
          recipientId: submission.contributorId,
          actorId: creator.id,
          bountyId: bountyId,
        },
      });
    } catch (notifErr) {
      console.error('Failed to create BOUNTY_WON notification:', notifErr);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/bounties/[id]/approve error:', error);
    return NextResponse.json(
      { error: 'Failed to approve submission' },
      { status: 500 }
    );
  }
}
