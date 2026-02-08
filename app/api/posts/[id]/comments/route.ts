import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            walletAddress: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const { walletAddress, content, parentId } = await request.json();

    if (!walletAddress || !content) {
      return NextResponse.json(
        { error: 'walletAddress and content are required' },
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

    const comment = await prisma.comment.create({
      data: {
        postId,
        authorId: user.id,
        content,
        parentId: parentId ?? null,
      },
      include: {
        author: {
          select: {
            walletAddress: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Create COMMENT notification (only if commenter !== post author)
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (post && post.authorId !== user.id) {
      try {
        await prisma.notification.create({
          data: {
            type: 'COMMENT',
            message: 'commented on your post',
            recipientId: post.authorId,
            actorId: user.id,
            postId: postId,
          },
        });
      } catch (notifErr) {
        console.error('Failed to create COMMENT notification:', notifErr);
      }
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
