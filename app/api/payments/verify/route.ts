/**
 * ZK Proof Verification API
 *
 * POST: Verify a ZK payment proof
 * GET: Get proof verification status / protocol info
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPaymentProof, isNullifierUsed } from '@/lib/zk';

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || '31337');
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS || '';

// GET: Protocol info and supported verification methods
export async function GET() {
  return NextResponse.json({
    protocol: 'x402',
    version: 1,
    zkProof: {
      supported: true,
      schemes: ['zk-exact'],
      description: 'Zero-knowledge payment proofs using Pedersen-commitment style hashing',
      features: [
        'Private payment verification',
        'Nullifier-based double-spend prevention',
        'Signature-bound proofs',
        'Time-limited validity (1 hour)',
      ],
    },
    network: {
      chainId: CHAIN_ID,
      contractAddress: CONTRACT_ADDRESS,
    },
  });
}

// POST: Verify a ZK proof
export async function POST(request: NextRequest) {
  try {
    const { zkProof, chainId, contractAddress } = await request.json();

    if (!zkProof) {
      return NextResponse.json(
        { error: 'zkProof is required' },
        { status: 400 }
      );
    }

    // Use provided chain/contract or defaults
    const targetChainId = chainId || CHAIN_ID;
    const targetContract = contractAddress || CONTRACT_ADDRESS;

    // Verify the proof
    const result = verifyPaymentProof(zkProof, targetChainId, targetContract);

    // Check nullifier
    const nullifierUsed = isNullifierUsed(zkProof.nullifier);

    return NextResponse.json({
      valid: result.valid && !nullifierUsed,
      commitment: result.commitment,
      nullifier: result.nullifier,
      nullifierUsed,
      error: result.error || (nullifierUsed ? 'Nullifier already used' : undefined),
      proofDetails: {
        scheme: 'zk-exact',
        timestamp: zkProof.proof?.timestamp,
        chainId: zkProof.publicInputs?.chainId,
        bountyId: zkProof.publicInputs?.bountyId,
      },
    });
  } catch (error: any) {
    console.error('POST /api/payments/verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
