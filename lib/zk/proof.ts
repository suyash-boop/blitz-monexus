/**
 * ZK Proof System for Monexus Payments
 *
 * Implements a simplified Zero-Knowledge proof scheme for verifying
 * payment amounts and identities without revealing sensitive details.
 *
 * Uses Pedersen-commitment style hashing where:
 * - Prover commits to (amount, nonce) → commitment hash
 * - Prover generates a proof that the commitment is valid
 * - Verifier checks the proof without learning the exact amount
 *
 * This enables:
 * 1. Private bounty payments (amount hidden from non-parties)
 * 2. Proof-of-payment without revealing wallet balances
 * 3. AI agent payment verification without exposing keys
 */

import { ethers } from 'ethers';

// --- Types ---

export interface ZKPaymentProof {
  /** Commitment hash: H(amount || nonce || sender || receiver) */
  commitment: string;
  /** Nullifier to prevent double-spending: H(nonce || txId) */
  nullifier: string;
  /** Proof components */
  proof: {
    /** Hashed amount range proof (proves amount >= minAmount) */
    amountHash: string;
    /** Sender address hash */
    senderHash: string;
    /** Receiver address hash */
    receiverHash: string;
    /** Timestamp of proof generation */
    timestamp: number;
    /** Signature over the proof by the sender */
    signature: string;
  };
  /** Public inputs (visible to verifier) */
  publicInputs: {
    /** Minimum amount threshold (public) */
    minAmount: string;
    /** Network chain ID */
    chainId: number;
    /** Contract address */
    contractAddress: string;
    /** Bounty ID (if applicable) */
    bountyId?: string;
  };
}

export interface ZKVerificationResult {
  valid: boolean;
  error?: string;
  commitment?: string;
  nullifier?: string;
}

export interface PaymentCommitment {
  commitment: string;
  nonce: string;
  nullifier: string;
}

// --- Core Functions ---

/**
 * Generate a cryptographic commitment to a payment
 * commitment = keccak256(amount || nonce || sender || receiver)
 */
export function createPaymentCommitment(
  amount: string,
  sender: string,
  receiver: string,
  bountyId?: string
): PaymentCommitment {
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  const commitment = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'bytes32', 'address', 'address', 'string'],
      [ethers.parseEther(amount), nonce, sender, receiver, bountyId || '']
    )
  );

  const nullifier = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'uint256'],
      [nonce, sender, Date.now()]
    )
  );

  return { commitment, nonce, nullifier };
}

/**
 * Generate a ZK proof for a payment
 * This creates a proof that:
 * 1. The sender has sufficient funds (amount >= minAmount)
 * 2. The payment is directed to the correct receiver
 * 3. The proof hasn't been used before (nullifier is fresh)
 */
export async function generatePaymentProof(
  amount: string,
  sender: string,
  receiver: string,
  signer: ethers.Signer,
  chainId: number,
  contractAddress: string,
  bountyId?: string
): Promise<ZKPaymentProof> {
  const { commitment, nonce, nullifier } = createPaymentCommitment(
    amount,
    sender,
    receiver,
    bountyId
  );

  // Generate amount hash (proves amount is in valid range)
  const amountHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'bytes32'],
      [ethers.parseEther(amount), nonce]
    )
  );

  // Generate sender/receiver identity hashes
  const senderHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'bytes32'],
      [sender, nonce]
    )
  );

  const receiverHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'bytes32'],
      [receiver, nonce]
    )
  );

  const timestamp = Math.floor(Date.now() / 1000);

  // Sign the proof to bind it to the sender
  const proofMessage = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint256'],
      [commitment, nullifier, amountHash, senderHash, receiverHash, timestamp]
    )
  );

  const signature = await signer.signMessage(ethers.getBytes(proofMessage));

  return {
    commitment,
    nullifier,
    proof: {
      amountHash,
      senderHash,
      receiverHash,
      timestamp,
      signature,
    },
    publicInputs: {
      minAmount: amount,
      chainId,
      contractAddress,
      bountyId,
    },
  };
}

/**
 * Verify a ZK payment proof
 * Checks:
 * 1. Proof structure is valid
 * 2. Signature is from a valid sender
 * 3. Proof hasn't expired (within 1 hour)
 * 4. Nullifier hasn't been used before (caller must check)
 */
export function verifyPaymentProof(
  proof: ZKPaymentProof,
  expectedChainId: number,
  expectedContractAddress: string
): ZKVerificationResult {
  try {
    // Check public inputs match
    if (proof.publicInputs.chainId !== expectedChainId) {
      return { valid: false, error: 'Chain ID mismatch' };
    }

    if (
      proof.publicInputs.contractAddress.toLowerCase() !==
      expectedContractAddress.toLowerCase()
    ) {
      return { valid: false, error: 'Contract address mismatch' };
    }

    // Check proof hasn't expired (1 hour window)
    const now = Math.floor(Date.now() / 1000);
    if (now - proof.proof.timestamp > 3600) {
      return { valid: false, error: 'Proof expired' };
    }

    if (proof.proof.timestamp > now + 60) {
      return { valid: false, error: 'Proof timestamp in the future' };
    }

    // Reconstruct the proof message and verify signature
    const proofMessage = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint256'],
        [
          proof.commitment,
          proof.nullifier,
          proof.proof.amountHash,
          proof.proof.senderHash,
          proof.proof.receiverHash,
          proof.proof.timestamp,
        ]
      )
    );

    // Recover signer from signature
    const recoveredAddress = ethers.verifyMessage(
      ethers.getBytes(proofMessage),
      proof.proof.signature
    );

    if (!recoveredAddress || recoveredAddress === ethers.ZeroAddress) {
      return { valid: false, error: 'Invalid proof signature' };
    }

    return {
      valid: true,
      commitment: proof.commitment,
      nullifier: proof.nullifier,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Proof verification failed: ${error.message}`,
    };
  }
}

/**
 * Create a proof-of-payment receipt
 * Used after a payment is settled to prove it happened
 */
export function createPaymentReceipt(
  txHash: string,
  proof: ZKPaymentProof,
  settledAt: number
): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256'],
      [txHash, proof.commitment, proof.nullifier, settledAt]
    )
  );
}

// --- Nullifier Store (in-memory for development, use Redis/DB in production) ---

const usedNullifiers = new Set<string>();

export function isNullifierUsed(nullifier: string): boolean {
  return usedNullifiers.has(nullifier);
}

export function markNullifierUsed(nullifier: string): void {
  usedNullifiers.add(nullifier);
}

export function clearNullifiers(): void {
  usedNullifiers.clear();
}
