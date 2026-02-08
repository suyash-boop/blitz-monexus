/**
 * x402 Protocol Integration for Monexus
 *
 * Implements the x402 HTTP payment protocol (HTTP 402 Payment Required)
 * for AI agent payments and API monetization.
 *
 * Flow:
 * 1. Client requests a protected resource
 * 2. Server responds with 402 + payment requirements in headers
 * 3. Client creates a payment (signs tx or ZK proof)
 * 4. Client retries request with PAYMENT-SIGNATURE header
 * 5. Server verifies payment, executes request, settles payment
 * 6. Server returns 200 with PAYMENT-RESPONSE header
 */

import { ethers } from 'ethers';
import { NextRequest, NextResponse } from 'next/server';
import {
  generatePaymentProof,
  verifyPaymentProof,
  isNullifierUsed,
  markNullifierUsed,
  ZKPaymentProof,
} from '@/lib/zk';

// --- Types ---

export interface PaymentRequirements {
  /** Payment scheme (e.g., 'exact', 'zk-exact') */
  scheme: 'exact' | 'zk-exact';
  /** Network identifier */
  network: string;
  /** Maximum amount required */
  maxAmountRequired: string;
  /** Address to pay to */
  payTo: string;
  /** Resource URL */
  resource: string;
  /** Human-readable description */
  description: string;
  /** MIME type of the response */
  mimeType: string;
  /** Contract address for on-chain settlement */
  contractAddress?: string;
  /** Bounty ID if this is a bounty-related payment */
  bountyId?: string;
}

export interface PaymentPayload {
  /** x402 protocol version */
  x402Version: number;
  /** Payment scheme used */
  scheme: 'exact' | 'zk-exact';
  /** Network identifier */
  network: string;
  /** The payment data */
  payload: {
    /** Sender address */
    sender: string;
    /** Transaction signature or ZK proof */
    signature?: string;
    /** ZK proof (if scheme is 'zk-exact') */
    zkProof?: ZKPaymentProof;
    /** Amount in native currency */
    amount: string;
    /** Nonce for replay protection */
    nonce: string;
    /** Timestamp */
    timestamp: number;
  };
}

export interface SettlementResponse {
  /** Whether settlement was successful */
  success: boolean;
  /** Transaction hash if settled on-chain */
  txHash?: string;
  /** Payment receipt (ZK proof of payment) */
  receipt?: string;
  /** Error message if settlement failed */
  error?: string;
}

export interface RoutePaymentConfig {
  /** Payment requirements for this route */
  price: string;
  /** Description of what the payment is for */
  description: string;
  /** Whether to use ZK proofs */
  useZkProof?: boolean;
  /** Bounty ID (for bounty-related routes) */
  bountyId?: string;
}

export type RoutesConfig = Record<string, RoutePaymentConfig>;

// --- Encoding/Decoding ---

export function encodePaymentRequired(
  requirements: PaymentRequirements[]
): string {
  return Buffer.from(JSON.stringify(requirements)).toString('base64');
}

export function decodePaymentRequired(
  encoded: string
): PaymentRequirements[] {
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
}

export function encodePaymentPayload(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodePaymentPayload(encoded: string): PaymentPayload {
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
}

export function encodeSettlementResponse(
  response: SettlementResponse
): string {
  return Buffer.from(JSON.stringify(response)).toString('base64');
}

// --- Server-side Middleware ---

/**
 * Create a 402 Payment Required response
 */
export function createPaymentRequiredResponse(
  requirements: PaymentRequirements[],
  message?: string
): NextResponse {
  const encoded = encodePaymentRequired(requirements);

  return NextResponse.json(
    {
      x402Version: 1,
      error: message || 'Payment Required',
      accepts: requirements,
    },
    {
      status: 402,
      headers: {
        'PAYMENT-REQUIRED': encoded,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Verify a payment from request headers
 */
export async function verifyPaymentFromRequest(
  request: NextRequest,
  requirements: PaymentRequirements,
  chainId: number
): Promise<{
  valid: boolean;
  payload?: PaymentPayload;
  error?: string;
}> {
  // Check for payment header (x402 v2: PAYMENT-SIGNATURE, v1: X-PAYMENT)
  const paymentHeader =
    request.headers.get('payment-signature') ||
    request.headers.get('x-payment');

  if (!paymentHeader) {
    return { valid: false, error: 'No payment header provided' };
  }

  try {
    const payload = decodePaymentPayload(paymentHeader);

    // Validate protocol version
    if (payload.x402Version !== 1) {
      return { valid: false, error: 'Unsupported x402 version' };
    }

    // Validate scheme matches
    if (payload.scheme !== requirements.scheme) {
      return { valid: false, error: 'Payment scheme mismatch' };
    }

    // Validate amount
    const requiredAmount = ethers.parseEther(requirements.maxAmountRequired);
    const paidAmount = ethers.parseEther(payload.payload.amount);

    if (paidAmount < requiredAmount) {
      return { valid: false, error: 'Insufficient payment amount' };
    }

    // Validate timestamp (not older than 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (now - payload.payload.timestamp > 300) {
      return { valid: false, error: 'Payment expired' };
    }

    // ZK proof verification
    if (payload.scheme === 'zk-exact' && payload.payload.zkProof) {
      const zkResult = verifyPaymentProof(
        payload.payload.zkProof,
        chainId,
        requirements.contractAddress || ''
      );

      if (!zkResult.valid) {
        return { valid: false, error: `ZK proof invalid: ${zkResult.error}` };
      }

      // Check nullifier hasn't been used
      if (isNullifierUsed(payload.payload.zkProof.nullifier)) {
        return { valid: false, error: 'Payment already used (nullifier spent)' };
      }
    }

    // Standard signature verification
    if (payload.scheme === 'exact' && payload.payload.signature) {
      const message = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'string', 'uint256'],
          [
            payload.payload.sender,
            paidAmount,
            payload.payload.nonce,
            payload.payload.timestamp,
          ]
        )
      );

      const recoveredAddress = ethers.verifyMessage(
        ethers.getBytes(message),
        payload.payload.signature
      );

      if (
        recoveredAddress.toLowerCase() !==
        payload.payload.sender.toLowerCase()
      ) {
        return { valid: false, error: 'Invalid payment signature' };
      }
    }

    return { valid: true, payload };
  } catch (error: any) {
    return {
      valid: false,
      error: `Payment verification failed: ${error.message}`,
    };
  }
}

/**
 * Settle a payment after successful request handling
 */
export async function settlePayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  provider: ethers.Provider,
  adminSigner?: ethers.Signer
): Promise<SettlementResponse> {
  try {
    // Mark ZK nullifier as used
    if (
      payload.scheme === 'zk-exact' &&
      payload.payload.zkProof
    ) {
      markNullifierUsed(payload.payload.zkProof.nullifier);
    }

    // For on-chain settlement, execute the transfer
    if (adminSigner && requirements.contractAddress) {
      const tx = await adminSigner.sendTransaction({
        to: requirements.payTo,
        value: ethers.parseEther(payload.payload.amount),
      });
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt?.hash || tx.hash,
        receipt: `settled:${receipt?.hash || tx.hash}:${Date.now()}`,
      };
    }

    // Off-chain settlement (record-based)
    return {
      success: true,
      receipt: `offchain:${payload.payload.nonce}:${Date.now()}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Settlement failed: ${error.message}`,
    };
  }
}

// --- Route Matching ---

export function matchRoute(
  pathname: string,
  method: string,
  routes: RoutesConfig
): { key: string; config: RoutePaymentConfig } | null {
  const routeKey = `${method.toUpperCase()} ${pathname}`;

  // Exact match
  if (routes[routeKey]) {
    return { key: routeKey, config: routes[routeKey] };
  }

  // Pattern match (supports wildcards)
  for (const [pattern, config] of Object.entries(routes)) {
    const [routeMethod, ...routeParts] = pattern.split(' ');
    const routePath = routeParts.join(' ');

    if (routeMethod !== method.toUpperCase() && routeMethod !== '*') continue;

    // Convert glob pattern to regex
    const regexPattern = routePath
      .replace(/\*/g, '.*')
      .replace(/\[([^\]]+)\]/g, '([^/]+)');

    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(pathname)) {
      return { key: pattern, config };
    }
  }

  return null;
}

/**
 * x402 Payment Middleware for Next.js API routes
 *
 * Wraps a handler to require x402 payment before execution.
 * Supports both standard and ZK proof payment schemes.
 */
export function withX402Payment(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  config: RoutePaymentConfig & {
    payTo: string;
    contractAddress?: string;
    chainId: number;
    network: string;
  }
) {
  return async (request: NextRequest, ...args: any[]) => {
    const scheme = config.useZkProof ? 'zk-exact' : 'exact';

    const requirements: PaymentRequirements = {
      scheme,
      network: config.network,
      maxAmountRequired: config.price,
      payTo: config.payTo,
      resource: request.url,
      description: config.description,
      mimeType: 'application/json',
      contractAddress: config.contractAddress,
      bountyId: config.bountyId,
    };

    // Check for payment
    const paymentResult = await verifyPaymentFromRequest(
      request,
      requirements,
      config.chainId
    );

    if (!paymentResult.valid) {
      return createPaymentRequiredResponse(
        [requirements],
        paymentResult.error
      );
    }

    // Execute the handler
    const response = await handler(request, ...args);

    // If response is successful, settle the payment
    if (response.status < 400 && paymentResult.payload) {
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'http://127.0.0.1:8545'
      );

      const settlement = await settlePayment(
        paymentResult.payload,
        requirements,
        provider
      );

      // Add settlement response header
      if (settlement.success) {
        response.headers.set(
          'PAYMENT-RESPONSE',
          encodeSettlementResponse(settlement)
        );
      }
    }

    return response;
  };
}
