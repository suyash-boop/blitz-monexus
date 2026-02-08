import { prisma } from '@/lib/prisma';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { ethers } from 'ethers';
import { BOUNTY_ESCROW_ABI, BOUNTY_ESCROW_ADDRESS } from '@/lib/contract';
import { MONAD_RPC_URL } from '@/config/chains';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Run the AI agent to submit work for a specific bounty.
 * Called automatically when a new bounty is created.
 */
export async function runAgentForBounty(bountyId: string) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.log('[AI Agent] GROQ_API_KEY not configured, skipping');
      return;
    }

    const agentWallet = process.env.AI_AGENT_WALLET_ADDRESS;
    if (!agentWallet) {
      console.log('[AI Agent] AI_AGENT_WALLET_ADDRESS not configured, skipping');
      return;
    }

    const agent = await prisma.user.findUnique({
      where: { walletAddress: agentWallet },
    });

    if (!agent) {
      console.log('[AI Agent] Agent user not found in DB, skipping');
      return;
    }

    // Fetch the specific bounty
    const bounty = await prisma.bounty.findUnique({
      where: { id: bountyId },
      include: {
        creator: { select: { id: true, walletAddress: true, displayName: true } },
        submissions: { where: { contributorId: agent.id } },
      },
    });

    if (!bounty) {
      console.log(`[AI Agent] Bounty ${bountyId} not found`);
      return;
    }

    if (bounty.status !== 'OPEN') {
      console.log(`[AI Agent] Bounty ${bountyId} is not OPEN, skipping`);
      return;
    }

    if (bounty.creatorId === agent.id) {
      console.log(`[AI Agent] Bounty ${bountyId} was created by the agent, skipping`);
      return;
    }

    if (bounty.submissions.length > 0) {
      console.log(`[AI Agent] Already submitted to bounty ${bountyId}, skipping`);
      return;
    }

    console.log(`[AI Agent] Generating submission for: "${bounty.title}"`);

    // Generate submission content
    const { text: submissionContent } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: `You are an AI agent completing a bounty on Monexus, a Monad blockchain community platform.

Bounty Title: ${bounty.title}
Description: ${bounty.description}
Requirements: ${bounty.requirements}
Reward: ${bounty.amount} MON

Generate a high-quality submission that addresses ALL the requirements. Be thorough, specific, and professional.

Important:
- Address each requirement directly
- Provide actionable, detailed content
- If the bounty asks for research, provide real insights
- If it asks for writing, deliver polished content
- If it asks for analysis, provide structured analysis with conclusions
- Be concise but comprehensive
- Do NOT mention that you are an AI or that this is generated
- Write as if you are a professional freelancer delivering work`,
    });

    // Create the submission in DB
    const submission = await prisma.submission.create({
      data: {
        bountyId: bounty.id,
        contributorId: agent.id,
        content: submissionContent,
        status: 'PENDING',
      },
    });

    console.log(`[AI Agent] Submission created: ${submission.id}`);

    // Create SUBMISSION_RECEIVED notification for bounty creator
    try {
      await prisma.notification.create({
        data: {
          type: 'SUBMISSION_RECEIVED',
          message: `AI Agent submitted work for "${bounty.title}"`,
          recipientId: bounty.creatorId,
          actorId: agent.id,
          bountyId: bounty.id,
        },
      });
    } catch (notifErr) {
      console.error('[AI Agent] Failed to create notification:', notifErr);
    }

    // Register on-chain
    if (bounty.contractBountyId && process.env.DEPLOYER_PRIVATE_KEY) {
      try {
        const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
        const adminWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(BOUNTY_ESCROW_ADDRESS, BOUNTY_ESCROW_ABI, adminWallet);
        const tx = await contract.registerSubmission(
          parseInt(bounty.contractBountyId),
          agentWallet
        );
        await tx.wait();
        console.log(`[AI Agent] Registered on-chain for bounty #${bounty.contractBountyId}`);
      } catch (chainErr) {
        console.error('[AI Agent] On-chain registration failed:', chainErr);
      }
    }

    console.log(`[AI Agent] Done — submitted to "${bounty.title}"`);
  } catch (error) {
    console.error('[AI Agent] Error:', error);
  }
}
