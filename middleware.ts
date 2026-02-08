/**
 * x402 Payment Middleware for Monexus
 *
 * Protects specified API routes with x402 payment requirements.
 * Supports both standard and ZK-proof payment schemes.
 *
 * Protected routes:
 * - POST /api/payments/transfer → requires payment for direct transfers
 * - POST /api/ai/agent → requires micro-payment for AI agent runs
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  matchRoute,
  verifyPaymentFromRequest,
  createPaymentRequiredResponse,
  PaymentRequirements,
  RoutesConfig,
} from '@/lib/x402';

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || '31337');
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS || '';
const AGENT_WALLET = process.env.AI_AGENT_WALLET_ADDRESS || '';
const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'http://127.0.0.1:8545';

/**
 * Routes that require x402 payment
 * Only these routes will trigger payment verification
 */
const PROTECTED_ROUTES: RoutesConfig = {
  'POST /api/ai/agent': {
    price: '0.001',
    description: 'Run the AI agent to discover and complete bounties',
    useZkProof: true,
  },
};

export async function middleware(request: NextRequest) {
  // Skip payment enforcement in development mode
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // Skip middleware for non-protected routes early
  if (!request.nextUrl.pathname.startsWith('/api/ai/agent')) {
    return NextResponse.next();
  }
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();

  // Check if this route requires payment
  const match = matchRoute(pathname, method, PROTECTED_ROUTES);

  if (!match) {
    return NextResponse.next();
  }

  const { config } = match;
  const scheme = config.useZkProof ? 'zk-exact' : 'exact';

  // Check for payment header
  const paymentHeader =
    request.headers.get('payment-signature') ||
    request.headers.get('x-payment');

  // If no payment header, return 402
  if (!paymentHeader) {
    const requirements: PaymentRequirements = {
      scheme,
      network: `eip155:${CHAIN_ID}`,
      maxAmountRequired: config.price,
      payTo: AGENT_WALLET || CONTRACT_ADDRESS,
      resource: `${request.nextUrl.protocol}//${request.nextUrl.host}${pathname}`,
      description: config.description,
      mimeType: 'application/json',
      contractAddress: CONTRACT_ADDRESS,
      bountyId: config.bountyId,
    };

    return createPaymentRequiredResponse(
      [requirements],
      'Payment required to access this resource'
    );
  }

  // Verify the payment
  const requirements: PaymentRequirements = {
    scheme,
    network: `eip155:${CHAIN_ID}`,
    maxAmountRequired: config.price,
    payTo: AGENT_WALLET || CONTRACT_ADDRESS,
    resource: request.url,
    description: config.description,
    mimeType: 'application/json',
    contractAddress: CONTRACT_ADDRESS,
    bountyId: config.bountyId,
  };

  const result = await verifyPaymentFromRequest(request, requirements, CHAIN_ID);

  if (!result.valid) {
    return createPaymentRequiredResponse(
      [requirements],
      result.error
    );
  }

  // Payment verified, proceed to handler
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/ai/agent'],
  runtime: 'nodejs',
};
