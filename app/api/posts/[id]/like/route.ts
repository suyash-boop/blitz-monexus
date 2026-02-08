import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/posts/[id]/like — toggle like
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    // Find or create user by wallet address
    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: {
        walletAddress,
        reputation: { create: {} },
      },
    });

    // Verify the post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if like already exists
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: user.id,
        },
      },
    });

    let liked: boolean;

    if (existingLike) {
      // Unlike — remove the like
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      liked = false;
    } else {
      // Like — create the like
      await prisma.like.create({
        data: {
          postId,
          userId: user.id,
        },
      });
      liked = true;

      // Create LIKE notification (only if liker !== post author)
      if (post.authorId !== user.id) {
        try {
          await prisma.notification.create({
            data: {
              type: 'LIKE',
              message: 'liked your post',
              recipientId: post.authorId,
              actorId: user.id,
              postId: postId,
            },
          });
        } catch (notifErr) {
          console.error('Failed to create LIKE notification:', notifErr);
        }
      }
    }

    // Get updated like count
    const count = await prisma.like.count({
      where: { postId },
    });

    return NextResponse.json({ liked, count });
  } catch (error) {
    console.error('POST /api/posts/[id]/like error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}
