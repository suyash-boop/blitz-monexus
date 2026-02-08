import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/users - Create or fetch user by wallet address
export async function POST(req: NextRequest) {
  try {
    const { walletAddress, privyUserId } = await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    // Upsert: find by walletAddress, create if not exists
    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {
        // Update privyUserId if provided and user already exists
        ...(privyUserId ? { privyUserId } : {}),
      },
      create: {
        walletAddress,
        ...(privyUserId ? { privyUserId } : {}),
        reputation: {
          create: {},
        },
      },
      include: {
        reputation: true,
      },
    });

    // If an existing user somehow has no reputation record, create one
    if (!user.reputation) {
      const reputation = await prisma.reputation.create({
        data: { userId: user.id },
      });
      return NextResponse.json({ ...user, reputation });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json(
      { error: 'Failed to create or fetch user' },
      { status: 500 }
    );
  }
}

// GET /api/users?address=0x... - Fetch user by wallet address
export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'address query parameter is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: address },
      include: {
        reputation: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('GET /api/users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PATCH /api/users - Update user profile
export async function PATCH(req: NextRequest) {
  try {
    const { walletAddress, displayName, bio, avatarUrl } = await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { walletAddress },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      include: {
        reputation: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('PATCH /api/users error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
