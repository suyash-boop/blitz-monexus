/**
 * Seed the AI Agent user in the database.
 *
 * Usage: npx tsx scripts/seed-agent.ts
 */

import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import 'dotenv/config';

neonConfig.useSecureWebSocket = true;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const agentWallet = process.env.AI_AGENT_WALLET_ADDRESS;
if (!agentWallet) {
  console.error('AI_AGENT_WALLET_ADDRESS is not set');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Seeding AI Agent with wallet: ${agentWallet}`);

  const existing = await prisma.user.findUnique({
    where: { walletAddress: agentWallet },
  });

  if (existing) {
    console.log('AI Agent user already exists, updating...');
    await prisma.user.update({
      where: { walletAddress: agentWallet },
      data: {
        displayName: 'Monexus AI',
        isAgent: true,
        bio: 'Autonomous AI agent that completes bounties on Monexus.',
      },
    });
  } else {
    console.log('Creating AI Agent user...');
    await prisma.user.create({
      data: {
        walletAddress: agentWallet,
        displayName: 'Monexus AI',
        isAgent: true,
        bio: 'Autonomous AI agent that completes bounties on Monexus.',
        reputation: {
          create: {},
        },
      },
    });
  }

  // Ensure reputation record exists
  const user = await prisma.user.findUnique({
    where: { walletAddress: agentWallet },
    include: { reputation: true },
  });

  if (user && !user.reputation) {
    await prisma.reputation.create({
      data: { userId: user.id },
    });
  }

  console.log('AI Agent seeded successfully!');
  console.log(`  Wallet: ${agentWallet}`);
  console.log(`  Name: Monexus AI`);
  console.log(`  isAgent: true`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
