/**
 * x402 Client SDK for Monexus
 *
 * Provides client-side utilities for making x402 payments
 * when interacting with protected API endpoints.
 */

import { ethers } from 'ethers';
import {
  PaymentPayload,
  PaymentRequirements,
  SettlementResponse,
  decodePaymentRequired,
  encodePaymentPayload,
} from './protocol';
import { generatePaymentProof } from '@/lib/zk';

// --- Types ---

export interface X402ClientConfig {
  /** Wallet signer for signing payments */
  signer: ethers.Signer;
  /** Wallet address */
  walletAddress: string;
  /** Chain ID */
  chainId: number;
  /** Whether to use ZK proofs by default */
  useZkProof?: boolean;
}

export interface X402FetchOptions extends RequestInit {
  /** Override the payment amount */
  paymentAmount?: string;
  /** Force ZK proof usage */
  forceZkProof?: boolean;
}

export interface X402Response<T = any> {
  data: T;
  settlement?: SettlementResponse;
  paymentRequired: boolean;
  paymentMade: boolean;
}

// --- Client Class ---

export class X402Client {
  private config: X402ClientConfig;

  constructor(config: X402ClientConfig) {
    this.config = config;
  }

  /**
   * Make an x402-aware fetch request
   * Automatically handles 402 responses by creating and attaching payments
   */
  async fetch<T = any>(
    url: string,
    options: X402FetchOptions = {}
  ): Promise<X402Response<T>> {
    const { paymentAmount, forceZkProof, ...fetchOptions } = options;

    // First attempt without payment
    const initialResponse = await fetch(url, fetchOptions);

    // If not 402, return directly
    if (initialResponse.status !== 402) {
      const data = await initialResponse.json();
      return {
        data,
        paymentRequired: false,
        paymentMade: false,
      };
    }

    // Handle 402 - extract payment requirements
    const paymentRequiredHeader =
      initialResponse.headers.get('payment-required');
    const responseBody = await initialResponse.json();

    let requirements: PaymentRequirements[];

    if (paymentRequiredHeader) {
      requirements = decodePaymentRequired(paymentRequiredHeader);
    } else if (responseBody.accepts) {
      requirements = responseBody.accepts;
    } else {
      throw new Error(
        'No payment requirements found in 402 response'
      );
    }

    // Select the first requirement (or find one matching our preferred scheme)
    const useZk = forceZkProof ?? this.config.useZkProof ?? false;
    const preferredScheme = useZk ? 'zk-exact' : 'exact';

    const selectedReq =
      requirements.find((r) => r.scheme === preferredScheme) ||
      requirements[0];

    if (!selectedReq) {
      throw new Error('No compatible payment scheme found');
    }

    // Create payment
    const payment = await this.createPayment(
      selectedReq,
      paymentAmount || selectedReq.maxAmountRequired,
      useZk
    );

    // Retry with payment header
    const paymentResponse = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...fetchOptions.headers,
        'PAYMENT-SIGNATURE': encodePaymentPayload(payment),
      },
    });

    const data = await paymentResponse.json();

    // Extract settlement response
    let settlement: SettlementResponse | undefined;
    const settlementHeader =
      paymentResponse.headers.get('payment-response');
    if (settlementHeader) {
      try {
        settlement = JSON.parse(
          Buffer.from(settlementHeader, 'base64').toString('utf-8')
        );
      } catch {
        // Ignore parsing errors
      }
    }

    return {
      data,
      settlement,
      paymentRequired: true,
      paymentMade: true,
    };
  }

  /**
   * Create a payment payload for a given requirement
   */
  private async createPayment(
    requirement: PaymentRequirements,
    amount: string,
    useZk: boolean
  ): Promise<PaymentPayload> {
    const nonce = ethers.hexlify(ethers.randomBytes(16));
    const timestamp = Math.floor(Date.now() / 1000);

    if (useZk || requirement.scheme === 'zk-exact') {
      // Generate ZK proof
      const zkProof = await generatePaymentProof(
        amount,
        this.config.walletAddress,
        requirement.payTo,
        this.config.signer,
        this.config.chainId,
        requirement.contractAddress || '',
        requirement.bountyId
      );

      return {
        x402Version: 1,
        scheme: 'zk-exact',
        network: requirement.network,
        payload: {
          sender: this.config.walletAddress,
          zkProof,
          amount,
          nonce,
          timestamp,
        },
      };
    }

    // Standard exact payment with signature
    const amountWei = ethers.parseEther(amount);
    const message = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'string', 'uint256'],
        [this.config.walletAddress, amountWei, nonce, timestamp]
      )
    );

    const signature = await this.config.signer.signMessage(
      ethers.getBytes(message)
    );

    return {
      x402Version: 1,
      scheme: 'exact',
      network: requirement.network,
      payload: {
        sender: this.config.walletAddress,
        signature,
        amount,
        nonce,
        timestamp,
      },
    };
  }
}

/**
 * Create a configured x402 client
 */
export function createX402Client(
  config: X402ClientConfig
): X402Client {
  return new X402Client(config);
}
