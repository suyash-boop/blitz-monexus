import { NextRequest, NextResponse } from 'next/server';
import { createGroq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { z } from 'zod';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const enhancedBountySchema = z.object({
  title: z.string().describe('A clear, compelling bounty title (5-12 words)'),
  description: z.string().describe('A detailed, well-structured bounty description (2-4 paragraphs)'),
  requirements: z.string().describe('Clear bullet-point requirements and deliverables'),
  tags: z.array(z.string()).describe('3-6 relevant tags (lowercase, single words)'),
  suggestedAmount: z.string().describe('Suggested reward amount in MON tokens (just the number)'),
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured' },
        { status: 500 }
      );
    }

    const { description, title, requirements, amount } = await request.json();

    if (!description?.trim()) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    const { object } = await generateObject({
      model: groq('llama-3.3-70b-versatile'),
      schema: enhancedBountySchema,
      prompt: `You are a bounty writing expert for Monexus, a Monad blockchain community platform where people post bounties (paid tasks) and contributors earn MON tokens by completing them.

Given the following rough bounty idea, create a polished, professional bounty listing:

${title ? `Rough title: ${title}` : ''}
Description/idea: ${description}
${requirements ? `Rough requirements: ${requirements}` : ''}
${amount ? `Budget hint: ${amount} MON` : ''}

Guidelines:
- Title should be action-oriented and specific (e.g., "Build a React Dashboard for Token Analytics")
- Description should explain the context, what needs to be built, and why it matters
- Requirements should be a numbered list of specific deliverables
- Tags should be relevant technical or category tags (e.g., "frontend", "solidity", "design", "content", "research")
- Suggested amount should be realistic for the scope of work (typical range: 0.01-10 MON for testnet). If the user gave a budget hint, use that.
- Keep the tone professional but approachable
- Focus on Monad/Web3/blockchain context where relevant`,
    });

    return NextResponse.json(object);
  } catch (error: any) {
    console.error('AI enhance bounty error:', error);
    return NextResponse.json(
      { error: error.message || 'AI enhancement failed' },
      { status: 500 }
    );
  }
}
