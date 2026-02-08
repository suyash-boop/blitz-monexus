/**
 * Fix existing bounties and submissions:
 * 1. Update DRAFT bounties with contractBountyId to OPEN status
 * 2. Register existing submissions on-chain
 *
 * Usage: npx tsx scripts/fix-bounty-status.ts
 */

import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import { ethers } from 'ethers';
import 'dotenv/config';

neonConfig.useSecureWebSocket = true;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const BOUNTY_ESCROW_ABI = [
  'function registerSubmission(uint256 bountyId, address contributor)',
  'function hasContributorSubmitted(uint256 bountyId, address contributor) view returns (bool)',
];

async function main() {
  // --- Step 1: Fix DRAFT → OPEN ---
  const draftBounties = await prisma.bounty.findMany({
    where: {
      status: 'DRAFT',
      contractBountyId: { not: null },
    },
    select: { id: true, title: true, contractBountyId: true },
  });

  console.log(`[Step 1] Found ${draftBounties.length} funded bounties stuck at DRAFT.\n`);

  for (const bounty of draftBounties) {
    console.log(`  Fixing: "${bounty.title}" (contract #${bounty.contractBountyId})`);
    await prisma.bounty.update({
      where: { id: bounty.id },
      data: { status: 'OPEN' },
    });
    console.log(`    → DRAFT → OPEN`);
  }

  // --- Step 2: Register existing submissions on-chain ---
  const contractAddress = process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS;
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';

  if (!contractAddress || !deployerKey) {
    console.log('\n[Step 2] Skipping on-chain registration (missing contract address or deployer key).');
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(deployerKey, provider);
  const contract = new ethers.Contract(contractAddress, BOUNTY_ESCROW_ABI, wallet);

  // Find submissions for bounties that have a contractBountyId
  const submissions = await prisma.submission.findMany({
    where: {
      bounty: {
        contractBountyId: { not: null },
      },
    },
    include: {
      bounty: { select: { contractBountyId: true, title: true } },
      contributor: { select: { walletAddress: true, displayName: true } },
    },
  });

  console.log(`\n[Step 2] Found ${submissions.length} submissions to check on-chain.\n`);

  for (const sub of submissions) {
    const bountyContractId = parseInt(sub.bounty.contractBountyId!);
    const contributorAddr = sub.contributor.walletAddress;
    const label = sub.contributor.displayName || contributorAddr;

    // Check if already registered on-chain
    const alreadyRegistered = await contract.hasContributorSubmitted(bountyContractId, contributorAddr);
    if (alreadyRegistered) {
      console.log(`  ✓ Already registered: ${label} on "${sub.bounty.title}"`);
      continue;
    }

    console.log(`  Registering: ${label} on "${sub.bounty.title}" (contract #${bountyContractId})...`);
    try {
      const tx = await contract.registerSubmission(bountyContractId, contributorAddr);
      await tx.wait();
      console.log(`    → Registered (tx: ${tx.hash})`);
    } catch (err: any) {
      console.error(`    ✗ Failed: ${err.message}`);
    }
  }

  console.log('\nDone!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
