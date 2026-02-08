import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { ethers } from 'ethers';
import { BOUNTY_ESCROW_ABI, BOUNTY_ESCROW_ADDRESS } from '@/lib/contract';
import { MONAD_RPC_URL } from '@/config/chains';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// GET: Return agent profile + stats + submissions
export async function GET() {
  try {
    const agentWallet = process.env.AI_AGENT_WALLET_ADDRESS;
    if (!agentWallet) {
      return NextResponse.json({ error: 'AI Agent not configured' }, { status: 500 });
    }

    const agent = await prisma.user.findUnique({
      where: { walletAddress: agentWallet },
      include: {
        reputation: true,
        submissions: {
          include: {
            bounty: {
              select: { id: true, title: true, amount: true, status: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'AI Agent user not found. Run seed-agent script.' }, { status: 404 });
    }

    return NextResponse.json(agent);
  } catch (error: any) {
    console.error('GET /api/ai/agent error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent data' }, { status: 500 });
  }
}

// POST: Run the agent — scan bounties, pick one, generate + submit work
export async function POST(request: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
    }

    const agentWallet = process.env.AI_AGENT_WALLET_ADDRESS;
    if (!agentWallet) {
      return NextResponse.json({ error: 'AI Agent not configured' }, { status: 500 });
    }

    const agent = await prisma.user.findUnique({
      where: { walletAddress: agentWallet },
    });

    if (!agent) {
      return NextResponse.json({ error: 'AI Agent user not found' }, { status: 404 });
    }

    // Step 1: Fetch open bounties the agent hasn't submitted to
    const openBounties = await prisma.bounty.findMany({
      where: {
        status: 'OPEN',
        deadline: { gt: new Date() },
        submissions: {
          none: { contributorId: agent.id },
        },
        creatorId: { not: agent.id },
      },
      include: {
        creator: { select: { displayName: true, walletAddress: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (openBounties.length === 0) {
      return NextResponse.json({
        status: 'no_bounties',
        message: 'No open bounties available for the agent to work on.',
        steps: [
          { step: 'scan', message: 'Scanned for open bounties', done: true },
          { step: 'result', message: 'No eligible bounties found', done: true },
        ],
      });
    }

    // Step 2: Ask AI to pick the best bounty
    const bountyList = openBounties.map((b, i) => (
      `${i + 1}. "${b.title}" — ${b.amount} MON — ${b.description.slice(0, 200)}... — Tags: ${b.tags.join(', ')} — ${b._count.submissions} submissions so far`
    )).join('\n');

    const { text: selectionResponse } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: `You are an AI agent on Monexus, a Monad blockchain community platform. You need to pick ONE bounty to work on from the list below.

You are good at: writing, research, analysis, documentation, content creation, strategy, brainstorming, and technical writing. You CANNOT do: coding (write actual code), design (create visuals), or deploy smart contracts.

Pick the bounty that best fits your capabilities. Respond with ONLY a JSON object like:
{"pick": 1, "reason": "Brief reason why this bounty fits my capabilities"}

Available bounties:
${bountyList}`,
    });

    // Parse the selection
    let pick = 0;
    let reason = '';
    try {
      const jsonMatch = selectionResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        pick = parsed.pick - 1;
        reason = parsed.reason;
      }
    } catch {
      pick = 0;
      reason = 'Selected the first available bounty';
    }

    if (pick < 0 || pick >= openBounties.length) pick = 0;
    const selectedBounty = openBounties[pick];

    // Step 3: Generate a submission
    const { text: submissionContent } = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      prompt: `You are an AI agent completing a bounty on Monexus, a Monad blockchain community platform.

Bounty Title: ${selectedBounty.title}
Description: ${selectedBounty.description}
Requirements: ${selectedBounty.requirements}
Reward: ${selectedBounty.amount} MON

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

    // Step 4: Create the submission in DB
    const submission = await prisma.submission.create({
      data: {
        bountyId: selectedBounty.id,
        contributorId: agent.id,
        content: submissionContent,
        status: 'PENDING',
      },
      include: {
        contributor: {
          select: { id: true, walletAddress: true, displayName: true, avatarUrl: true },
        },
      },
    });

    // Step 5: Register on-chain
    let onChainRegistered = false;
    if (selectedBounty.contractBountyId && process.env.DEPLOYER_PRIVATE_KEY) {
      try {
        const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
        const adminWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(BOUNTY_ESCROW_ADDRESS, BOUNTY_ESCROW_ABI, adminWallet);
        const tx = await contract.registerSubmission(
          parseInt(selectedBounty.contractBountyId),
          agentWallet
        );
        await tx.wait();
        onChainRegistered = true;
      } catch (chainErr) {
        console.error('Agent on-chain registration failed:', chainErr);
      }
    }

    return NextResponse.json({
      status: 'submitted',
      bounty: {
        id: selectedBounty.id,
        title: selectedBounty.title,
        amount: selectedBounty.amount,
      },
      reason,
      submission: {
        id: submission.id,
        content: submissionContent.slice(0, 500) + (submissionContent.length > 500 ? '...' : ''),
      },
      onChainRegistered,
      steps: [
        { step: 'scan', message: `Scanned ${openBounties.length} open bounties`, done: true },
        { step: 'select', message: `Selected: "${selectedBounty.title}" — ${reason}`, done: true },
        { step: 'generate', message: 'Generated submission content', done: true },
        { step: 'submit', message: 'Submission created successfully', done: true },
        { step: 'onchain', message: onChainRegistered ? 'Registered on-chain' : 'On-chain registration skipped', done: true },
      ],
    });
  } catch (error: any) {
    console.error('POST /api/ai/agent error:', error);
    return NextResponse.json(
      { error: error.message || 'Agent run failed' },
      { status: 500 }
    );
  }
}
