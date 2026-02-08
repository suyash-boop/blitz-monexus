import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runAgentForBounty } from '@/lib/ai-agent';

// GET /api/posts?type=REGULAR|BOUNTY&cursor=id&limit=20&userId=id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type') as 'REGULAR' | 'BOUNTY' | null;
    const cursor = searchParams.get('cursor');
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);
    const userId = searchParams.get('userId');

    const posts = await prisma.post.findMany({
      where: {
        ...(type && { type }),
      },
      take: limit + 1, // Fetch one extra to determine if there's a next page
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor itself
      }),
      orderBy: { createdAt: 'desc' },
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
        ...(userId && {
          likes: {
            where: { userId },
            select: { id: true },
          },
        }),
      },
    });

    // Determine if there's a next page
    let nextCursor: string | undefined;
    if (posts.length > limit) {
      const nextItem = posts.pop();
      nextCursor = nextItem?.id;
    }

    // Map posts to include isLiked boolean
    const formattedPosts = posts.map((post) => {
      const { likes, ...rest } = post as typeof post & { likes?: { id: string }[] };
      return {
        ...rest,
        isLiked: userId ? (likes?.length ?? 0) > 0 : false,
      };
    });

    return NextResponse.json({
      posts: formattedPosts,
      nextCursor,
    });
  } catch (error) {
    console.error('GET /api/posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

// POST /api/posts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, content, type = 'REGULAR', bounty, images } = body;

    if (!walletAddress || !content) {
      return NextResponse.json(
        { error: 'walletAddress and content are required' },
        { status: 400 }
      );
    }

    // Find or create user by wallet address (handles race condition
    // where user connects wallet but registration hasn't completed yet)
    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      // Auto-register the user if they don't exist yet
      user = await prisma.user.upsert({
        where: { walletAddress },
        update: {},
        create: {
          walletAddress,
          reputation: {
            create: {},
          },
        },
      });
    }

    // Validate bounty data if type is BOUNTY
    if (type === 'BOUNTY') {
      if (!bounty || !bounty.title || !bounty.description || !bounty.amount || !bounty.deadline) {
        return NextResponse.json(
          { error: 'Bounty posts require title, description, amount, and deadline' },
          { status: 400 }
        );
      }
    }

    // Create the post (and bounty if applicable)
    const post = await prisma.post.create({
      data: {
        authorId: user.id,
        content,
        type,
        ...(type === 'BOUNTY' && bounty && {
          bounty: {
            create: {
              creatorId: user.id,
              title: bounty.title,
              description: bounty.description,
              requirements: bounty.requirements ?? '',
              amount: String(bounty.amount),
              deadline: new Date(bounty.deadline),
              tags: bounty.tags ?? [],
              contractBountyId: bounty.contractBountyId ?? null,
              txHash: bounty.txHash ?? null,
              maxWinners: bounty.maxWinners ?? 1,
              splitEqually: bounty.splitEqually ?? true,
              status: bounty.contractBountyId ? 'OPEN' : 'DRAFT',
            },
          },
        }),
        ...(images && images.length > 0 && {
          media: {
            create: images.map((url: string) => ({
              type: 'IMAGE' as const,
              url,
            })),
          },
        }),
      },
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
      },
    });

    // If a bounty was created, trigger the AI agent (fire-and-forget)
    if (type === 'BOUNTY' && post.bounty?.id) {
      runAgentForBounty(post.bounty.id).catch((err) =>
        console.error('[AI Agent] Background trigger failed:', err)
      );
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('POST /api/posts error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create post';
    return NextResponse.json(
      { error: 'Failed to create post', details: message },
      { status: 500 }
    );
  }
}
