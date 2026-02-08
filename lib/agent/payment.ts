/**
 * AI Agent Payment Service
 *
 * Handles autonomous payments by the AI agent using:
 * - x402 protocol for HTTP-native payments
 * - ZK proofs for private payment verification
 *
 * The agent can:
 * 1. Pay for bounty submissions on behalf of creators
 * 2. Receive payments for completed bounties
 * 3. Handle escrow operations via smart contract
 * 4. Generate ZK proofs for payment privacy
 */

import { ethers } from 'ethers';
import { BOUNTY_ESCROW_ABI, BOUNTY_ESCROW_ADDRESS } from '@/lib/contract';
import { generatePaymentProof, verifyPaymentProof, ZKPaymentProof } from '@/lib/zk';
import {
  PaymentPayload,
  encodePaymentPayload,
  SettlementResponse,
} from '@/lib/x402';

// --- Types ---

export interface AgentPaymentConfig {
  /** Agent's wallet private key */
  privateKey: string;
  /** RPC URL */
  rpcUrl: string;
  /** Chain ID */
  chainId: number;
  /** Contract address */
  contractAddress: string;
}

export interface AgentPaymentResult {
  success: boolean;
  txHash?: string;
  zkProof?: ZKPaymentProof;
  receipt?: string;
  error?: string;
  gasUsed?: string;
  amount?: string;
}

export interface BountyPaymentDetails {
  bountyId: number;
  amount: string;
  receiver: string;
  useZkProof: boolean;
}

// --- Agent Payment Service ---

export class AgentPaymentService {
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private chainId: number;
  private contractAddress: string;

  constructor(config: AgentPaymentConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.contract = new ethers.Contract(
      config.contractAddress,
      BOUNTY_ESCROW_ABI,
      this.wallet
    );
    this.chainId = config.chainId;
    this.contractAddress = config.contractAddress;
  }

  /**
   * Get the agent's wallet address
   */
  get address(): string {
    return this.wallet.address;
  }

  /**
   * Get the agent's balance
   */
  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /**
   * Create an x402 payment header for authenticated API calls
   */
  async createX402PaymentHeader(
    amount: string,
    receiver: string,
    useZkProof: boolean = false
  ): Promise<string> {
    const nonce = ethers.hexlify(ethers.randomBytes(16));
    const timestamp = Math.floor(Date.now() / 1000);

    let payload: PaymentPayload;

    if (useZkProof) {
      const zkProof = await generatePaymentProof(
        amount,
        this.wallet.address,
        receiver,
        this.wallet,
        this.chainId,
        this.contractAddress
      );

      payload = {
        x402Version: 1,
        scheme: 'zk-exact',
        network: `eip155:${this.chainId}`,
        payload: {
          sender: this.wallet.address,
          zkProof,
          amount,
          nonce,
          timestamp,
        },
      };
    } else {
      const amountWei = ethers.parseEther(amount);
      const message = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'string', 'uint256'],
          [this.wallet.address, amountWei, nonce, timestamp]
        )
      );
      const signature = await this.wallet.signMessage(ethers.getBytes(message));

      payload = {
        x402Version: 1,
        scheme: 'exact',
        network: `eip155:${this.chainId}`,
        payload: {
          sender: this.wallet.address,
          signature,
          amount,
          nonce,
          timestamp,
        },
      };
    }

    return encodePaymentPayload(payload);
  }

  /**
   * Execute a bounty payment through the escrow contract
   * Used when the agent is a bounty creator paying winners
   */
  async payBountyWinner(details: BountyPaymentDetails): Promise<AgentPaymentResult> {
    try {
      // Generate ZK proof if requested
      let zkProof: ZKPaymentProof | undefined;
      if (details.useZkProof) {
        zkProof = await generatePaymentProof(
          details.amount,
          this.wallet.address,
          details.receiver,
          this.wallet,
          this.chainId,
          this.contractAddress,
          String(details.bountyId)
        );
      }

      // Select winner and execute payout through contract
      const tx = await this.contract.selectWinners(
        details.bountyId,
        [details.receiver],
        [ethers.parseEther(details.amount)]
      );

      const receipt = await tx.wait();

      // Execute the payout
      const payoutTx = await this.contract.executePayout(details.bountyId);
      const payoutReceipt = await payoutTx.wait();

      return {
        success: true,
        txHash: payoutReceipt?.hash || payoutTx.hash,
        zkProof,
        receipt: `bounty:${details.bountyId}:${payoutReceipt?.hash || payoutTx.hash}`,
        gasUsed: receipt?.gasUsed?.toString(),
        amount: details.amount,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Bounty payment failed: ${error.message}`,
      };
    }
  }

  /**
   * Create a bounty with escrow through the smart contract
   */
  async createBountyEscrow(
    amount: string,
    deadline: Date,
    maxWinners: number = 1,
    splitEqually: boolean = true
  ): Promise<AgentPaymentResult> {
    try {
      const deadlineTimestamp = Math.floor(deadline.getTime() / 1000);
      const amountWei = ethers.parseEther(amount);

      const tx = await this.contract.createBounty(
        deadlineTimestamp,
        maxWinners,
        splitEqually,
        { value: amountWei }
      );

      const receipt = await tx.wait();

      // Extract bounty ID from event
      let bountyId = '0';
      if (receipt?.logs) {
        for (const log of receipt.logs) {
          try {
            const parsed = this.contract.interface.parseLog(log);
            if (parsed?.name === 'BountyCreated') {
              bountyId = parsed.args.bountyId.toString();
              break;
            }
          } catch {
            continue;
          }
        }
      }

      return {
        success: true,
        txHash: receipt?.hash || tx.hash,
        receipt: `bounty-created:${bountyId}:${receipt?.hash || tx.hash}`,
        gasUsed: receipt?.gasUsed?.toString(),
        amount,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Bounty creation failed: ${error.message}`,
      };
    }
  }

  /**
   * Direct transfer with optional ZK proof
   */
  async transfer(
    to: string,
    amount: string,
    useZkProof: boolean = false
  ): Promise<AgentPaymentResult> {
    try {
      let zkProof: ZKPaymentProof | undefined;

      if (useZkProof) {
        zkProof = await generatePaymentProof(
          amount,
          this.wallet.address,
          to,
          this.wallet,
          this.chainId,
          this.contractAddress
        );
      }

      const tx = await this.wallet.sendTransaction({
        to,
        value: ethers.parseEther(amount),
      });

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt?.hash || tx.hash,
        zkProof,
        receipt: `transfer:${receipt?.hash || tx.hash}:${Date.now()}`,
        gasUsed: receipt?.gasUsed?.toString(),
        amount,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Transfer failed: ${error.message}`,
      };
    }
  }

  /**
   * Verify a received ZK payment proof
   */
  verifyReceivedPayment(proof: ZKPaymentProof): boolean {
    const result = verifyPaymentProof(
      proof,
      this.chainId,
      this.contractAddress
    );
    return result.valid;
  }

  /**
   * Make an x402-authenticated API call
   * The agent uses this to call protected endpoints with payment
   */
  async callProtectedEndpoint(
    url: string,
    method: string = 'GET',
    amount: string = '0.001',
    body?: any,
    useZkProof: boolean = true
  ): Promise<any> {
    // First, try without payment
    const initialResponse = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body && { body: JSON.stringify(body) }),
    });

    // If not 402, return directly
    if (initialResponse.status !== 402) {
      return initialResponse.json();
    }

    // Create payment and retry
    const responseBody = await initialResponse.json();
    const payTo = responseBody.accepts?.[0]?.payTo || '';

    const paymentHeader = await this.createX402PaymentHeader(
      amount,
      payTo,
      useZkProof
    );

    const paymentResponse = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'PAYMENT-SIGNATURE': paymentHeader,
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    return paymentResponse.json();
  }
}

/**
 * Create an agent payment service from environment variables
 */
export function createAgentPaymentService(): AgentPaymentService | null {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'http://127.0.0.1:8545';
  const chainId = parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || '31337');
  const contractAddress = process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS || '';

  if (!privateKey) {
    console.warn('DEPLOYER_PRIVATE_KEY not set, agent payments disabled');
    return null;
  }

  return new AgentPaymentService({
    privateKey,
    rpcUrl,
    chainId,
    contractAddress,
  });
}
