import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/notifications?walletAddress=0x...
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.nextUrl.searchParams.get('walletAddress');
    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: user.id },
        include: {
          actor: {
            select: { walletAddress: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { recipientId: user.id, read: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// PATCH /api/notifications — mark as read
export async function PATCH(request: NextRequest) {
  try {
    const { walletAddress, notificationIds } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (notificationIds?.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          recipientId: user.id,
        },
        data: { read: true },
      });
    } else {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { recipientId: user.id, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/notifications error:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
