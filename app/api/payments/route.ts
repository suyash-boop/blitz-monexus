/**
 * x402-Protected Payment API Route
 *
 * Handles:
 * - GET: Returns payment requirements (402) or payment status
 * - POST: Process a payment (bounty payout, transfer, escrow)
 *
 * All requests require x402 payment headers with ZK proof support.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAgentPaymentService } from '@/lib/agent';
import {
  verifyPaymentFromRequest,
  createPaymentRequiredResponse,
  settlePayment,
  encodeSettlementResponse,
  PaymentRequirements,
} from '@/lib/x402';
import { ethers } from 'ethers';

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || '31337');
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS || '';
const AGENT_WALLET = process.env.AI_AGENT_WALLET_ADDRESS || '';
const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'http://127.0.0.1:8545';

// GET: Return payment requirements or agent payment status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');

    // Return payment history
    if (action === 'history') {
      const address = searchParams.get('address');
      if (!address) {
        return NextResponse.json({ error: 'address required' }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { walletAddress: address },
        include: {
          reputation: true,
          bountiesCreated: {
            where: { status: 'COMPLETED' },
            select: { id: true, title: true, amount: true, txHash: true },
            take: 10,
          },
        },
      });

      return NextResponse.json({
        user: user ? {
          address: user.walletAddress,
          totalEarned: user.reputation?.totalEarned || '0',
          totalSpent: user.reputation?.totalSpent || '0',
          bountiesCompleted: user.reputation?.bountiesCompleted || 0,
        } : null,
        x402: {
          version: 1,
          supportedSchemes: ['exact', 'zk-exact'],
          network: `eip155:${CHAIN_ID}`,
          contractAddress: CONTRACT_ADDRESS,
        },
      });
    }

    // Return agent payment capabilities
    if (action === 'capabilities') {
      const agentService = createAgentPaymentService();

      return NextResponse.json({
        agent: {
          address: AGENT_WALLET,
          balance: agentService ? await agentService.getBalance() : '0',
          capabilities: [
            'bounty-payment',
            'escrow-creation',
            'zk-proof-generation',
            'x402-authenticated-calls',
          ],
        },
        x402: {
          version: 1,
          supportedSchemes: ['exact', 'zk-exact'],
          network: `eip155:${CHAIN_ID}`,
        },
      });
    }

    // Default: return payment requirements (402)
    const requirements: PaymentRequirements = {
      scheme: 'zk-exact',
      network: `eip155:${CHAIN_ID}`,
      maxAmountRequired: '0.001',
      payTo: AGENT_WALLET || CONTRACT_ADDRESS,
      resource: request.url,
      description: 'Monexus AI Agent Payment API',
      mimeType: 'application/json',
      contractAddress: CONTRACT_ADDRESS,
    };

    return createPaymentRequiredResponse([requirements]);
  } catch (error: any) {
    console.error('GET /api/payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Process a payment action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      walletAddress,
      bountyId,
      submissionId,
      amount,
      receiver,
      useZkProof = true,
    } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    const agentService = createAgentPaymentService();

    switch (action) {
      // --- Agent pays bounty winner ---
      case 'pay-bounty': {
        if (!bountyId || !submissionId || !walletAddress) {
          return NextResponse.json(
            { error: 'bountyId, submissionId, and walletAddress are required' },
            { status: 400 }
          );
        }

        // Verify the caller is the bounty creator
        const bounty = await prisma.bounty.findUnique({
          where: { id: bountyId },
          include: { creator: true },
        });

        if (!bounty) {
          return NextResponse.json({ error: 'Bounty not found' }, { status: 404 });
        }

        if (bounty.creator.walletAddress !== walletAddress) {
          // Check x402 payment header for non-creator payments
          const requirements: PaymentRequirements = {
            scheme: useZkProof ? 'zk-exact' : 'exact',
            network: `eip155:${CHAIN_ID}`,
            maxAmountRequired: bounty.amount,
            payTo: bounty.creator.walletAddress,
            resource: request.url,
            description: `Bounty payment: ${bounty.title}`,
            mimeType: 'application/json',
            contractAddress: CONTRACT_ADDRESS,
            bountyId: bounty.id,
          };

          const paymentResult = await verifyPaymentFromRequest(
            request,
            requirements,
            CHAIN_ID
          );

          if (!paymentResult.valid) {
            return createPaymentRequiredResponse(
              [requirements],
              paymentResult.error
            );
          }
        }

        // Execute payment via agent service
        if (agentService && bounty.contractBountyId) {
          const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: { contributor: true },
          });

          if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
          }

          const result = await agentService.payBountyWinner({
            bountyId: parseInt(bounty.contractBountyId),
            amount: bounty.amount,
            receiver: submission.contributor.walletAddress,
            useZkProof,
          });

          if (result.success) {
            // Update DB
            await prisma.$transaction([
              prisma.submission.update({
                where: { id: submissionId },
                data: { status: 'APPROVED' },
              }),
              prisma.bounty.update({
                where: { id: bountyId },
                data: { status: 'COMPLETED', txHash: result.txHash },
              }),
              prisma.bountyWinner.create({
                data: {
                  bountyId,
                  submissionId,
                  amount: bounty.amount,
                  percentage: 100,
                  txHash: result.txHash,
                  paidAt: new Date(),
                },
              }),
            ]);
          }

          return NextResponse.json({
            status: result.success ? 'paid' : 'failed',
            ...result,
            x402: {
              version: 1,
              scheme: useZkProof ? 'zk-exact' : 'exact',
              settled: result.success,
            },
          });
        }

        return NextResponse.json(
          { error: 'Agent payment service not available' },
          { status: 503 }
        );
      }

      // --- Agent creates escrow bounty ---
      case 'create-escrow': {
        if (!amount || !walletAddress) {
          return NextResponse.json(
            { error: 'amount and walletAddress are required' },
            { status: 400 }
          );
        }

        if (!agentService) {
          return NextResponse.json(
            { error: 'Agent payment service not available' },
            { status: 503 }
          );
        }

        const deadline = body.deadline
          ? new Date(body.deadline)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default

        const result = await agentService.createBountyEscrow(
          amount,
          deadline,
          body.maxWinners || 1,
          body.splitEqually ?? true
        );

        return NextResponse.json({
          status: result.success ? 'created' : 'failed',
          ...result,
          x402: {
            version: 1,
            scheme: 'exact',
            settled: result.success,
          },
        });
      }

      // --- Direct transfer with ZK proof ---
      case 'transfer': {
        if (!amount || !receiver) {
          return NextResponse.json(
            { error: 'amount and receiver are required' },
            { status: 400 }
          );
        }

        // Verify x402 payment
        const requirements: PaymentRequirements = {
          scheme: useZkProof ? 'zk-exact' : 'exact',
          network: `eip155:${CHAIN_ID}`,
          maxAmountRequired: amount,
          payTo: receiver,
          resource: request.url,
          description: 'Direct transfer',
          mimeType: 'application/json',
          contractAddress: CONTRACT_ADDRESS,
        };

        const paymentResult = await verifyPaymentFromRequest(
          request,
          requirements,
          CHAIN_ID
        );

        if (!paymentResult.valid) {
          return createPaymentRequiredResponse(
            [requirements],
            paymentResult.error
          );
        }

        if (!agentService) {
          return NextResponse.json(
            { error: 'Agent payment service not available' },
            { status: 503 }
          );
        }

        const result = await agentService.transfer(receiver, amount, useZkProof);

        const response = NextResponse.json({
          status: result.success ? 'transferred' : 'failed',
          ...result,
          x402: {
            version: 1,
            scheme: useZkProof ? 'zk-exact' : 'exact',
            settled: result.success,
          },
        });

        // Add settlement header
        if (result.success) {
          response.headers.set(
            'PAYMENT-RESPONSE',
            encodeSettlementResponse({
              success: true,
              txHash: result.txHash,
              receipt: result.receipt,
            })
          );
        }

        return response;
      }

      // --- Verify a ZK proof ---
      case 'verify-proof': {
        if (!body.zkProof) {
          return NextResponse.json(
            { error: 'zkProof is required' },
            { status: 400 }
          );
        }

        if (!agentService) {
          return NextResponse.json(
            { error: 'Agent payment service not available' },
            { status: 503 }
          );
        }

        const isValid = agentService.verifyReceivedPayment(body.zkProof);

        return NextResponse.json({
          valid: isValid,
          commitment: body.zkProof.commitment,
          nullifier: body.zkProof.nullifier,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('POST /api/payments error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment processing failed' },
      { status: 500 }
    );
  }
}
