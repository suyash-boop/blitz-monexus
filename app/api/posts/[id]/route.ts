import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/posts/[id] — fetch a single post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.nextUrl.searchParams.get('userId');

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            walletAddress: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        bounty: true,
        media: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        ...(userId
          ? {
              likes: {
                where: { userId },
                select: { id: true },
              },
            }
          : {}),
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const { likes, ...rest } = post as typeof post & { likes?: { id: string }[] };

    return NextResponse.json({
      ...rest,
      isLiked: userId ? (likes?.length ?? 0) > 0 : false,
    });
  } catch (error) {
    console.error('GET /api/posts/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch post' },
      { status: 500 }
    );
  }
}
