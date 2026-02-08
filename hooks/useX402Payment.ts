'use client';

import { useState, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { useAuth } from './useAuth';

interface PaymentState {
  status: 'idle' | 'creating-proof' | 'sending' | 'verifying' | 'settled' | 'error';
  txHash?: string;
  receipt?: string;
  error?: string;
  zkProof?: any;
}

interface PaymentResult {
  success: boolean;
  data?: any;
  settlement?: {
    txHash?: string;
    receipt?: string;
  };
}

export function useX402Payment() {
  const { getSigner, getProvider, walletAddress, isConnected } = useAuth();
  const [paymentState, setPaymentState] = useState<PaymentState>({ status: 'idle' });

  /**
   * Make an x402-authenticated API call
   * Automatically handles 402 responses by signing a payment
   */
  const x402Fetch = useCallback(
    async (
      url: string,
      options: RequestInit & {
        paymentAmount?: string;
        useZkProof?: boolean;
      } = {}
    ): Promise<PaymentResult> => {
      if (!isConnected || !walletAddress) {
        throw new Error('Wallet not connected');
      }

      const { paymentAmount, useZkProof = true, ...fetchOptions } = options;

      setPaymentState({ status: 'sending' });

      try {
        // First attempt without payment
        const initialResponse = await fetch(url, fetchOptions);

        // If not 402, return directly
        if (initialResponse.status !== 402) {
          const data = await initialResponse.json();
          setPaymentState({ status: 'idle' });
          return { success: initialResponse.ok, data };
        }

        // Handle 402 — create and attach payment
        const responseBody = await initialResponse.json();
        const requirements = responseBody.accepts?.[0];

        if (!requirements) {
          throw new Error('No payment requirements in 402 response');
        }

        setPaymentState({ status: 'creating-proof' });

        const amount = paymentAmount || requirements.maxAmountRequired || '0.001';
        const signer = await getSigner();
        const nonce = ethers.hexlify(ethers.randomBytes(16));
        const timestamp = Math.floor(Date.now() / 1000);

        let paymentPayload: any;

        if (useZkProof && requirements.scheme === 'zk-exact') {
          // Create ZK proof
          const commitment = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ['uint256', 'bytes32', 'address', 'address', 'string'],
              [
                ethers.parseEther(amount),
                ethers.keccak256(ethers.toUtf8Bytes(nonce)),
                walletAddress,
                requirements.payTo || '',
                requirements.bountyId || '',
              ]
            )
          );

          const nullifier = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ['bytes32', 'address', 'uint256'],
              [ethers.keccak256(ethers.toUtf8Bytes(nonce)), walletAddress, timestamp]
            )
          );

          const amountHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ['uint256', 'bytes32'],
              [ethers.parseEther(amount), ethers.keccak256(ethers.toUtf8Bytes(nonce))]
            )
          );

          const senderHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ['address', 'bytes32'],
              [walletAddress, ethers.keccak256(ethers.toUtf8Bytes(nonce))]
            )
          );

          const receiverHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ['address', 'bytes32'],
              [requirements.payTo || ethers.ZeroAddress, ethers.keccak256(ethers.toUtf8Bytes(nonce))]
            )
          );

          const proofMessage = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint256'],
              [commitment, nullifier, amountHash, senderHash, receiverHash, timestamp]
            )
          );

          const signature = await signer.signMessage(ethers.getBytes(proofMessage));

          paymentPayload = {
            x402Version: 1,
            scheme: 'zk-exact',
            network: requirements.network,
            payload: {
              sender: walletAddress,
              zkProof: {
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
                  chainId: requirements.network?.split(':')?.[1]
                    ? parseInt(requirements.network.split(':')[1])
                    : 31337,
                  contractAddress: requirements.contractAddress || '',
                  bountyId: requirements.bountyId,
                },
              },
              amount,
              nonce,
              timestamp,
            },
          };

          setPaymentState({ status: 'verifying', zkProof: paymentPayload.payload.zkProof });
        } else {
          // Standard signature payment
          const amountWei = ethers.parseEther(amount);
          const message = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ['address', 'uint256', 'string', 'uint256'],
              [walletAddress, amountWei, nonce, timestamp]
            )
          );

          const signature = await signer.signMessage(ethers.getBytes(message));

          paymentPayload = {
            x402Version: 1,
            scheme: 'exact',
            network: requirements.network,
            payload: {
              sender: walletAddress,
              signature,
              amount,
              nonce,
              timestamp,
            },
          };

          setPaymentState({ status: 'verifying' });
        }

        // Encode and retry with payment
        const encodedPayment = btoa(JSON.stringify(paymentPayload));

        const paymentResponse = await fetch(url, {
          ...fetchOptions,
          headers: {
            ...fetchOptions.headers,
            'PAYMENT-SIGNATURE': encodedPayment,
          },
        });

        const data = await paymentResponse.json();

        // Extract settlement response
        const settlementHeader = paymentResponse.headers.get('payment-response');
        let settlement: any;
        if (settlementHeader) {
          try {
            settlement = JSON.parse(atob(settlementHeader));
          } catch {}
        }

        if (paymentResponse.ok) {
          setPaymentState({
            status: 'settled',
            txHash: settlement?.txHash || data?.txHash,
            receipt: settlement?.receipt || data?.receipt,
          });
        } else {
          setPaymentState({
            status: 'error',
            error: data?.error || 'Payment failed',
          });
        }

        return {
          success: paymentResponse.ok,
          data,
          settlement,
        };
      } catch (error: any) {
        setPaymentState({ status: 'error', error: error.message });
        throw error;
      }
    },
    [isConnected, walletAddress, getSigner]
  );

  /**
   * Pay for a bounty submission
   */
  const payBounty = useCallback(
    async (bountyId: string, submissionId: string) => {
      return x402Fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay-bounty',
          bountyId,
          submissionId,
          walletAddress,
          useZkProof: true,
        }),
        useZkProof: true,
      });
    },
    [x402Fetch, walletAddress]
  );

  /**
   * Run the AI agent with x402 payment
   */
  const runAgentWithPayment = useCallback(async () => {
    return x402Fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      useZkProof: true,
      paymentAmount: '0.001',
    });
  }, [x402Fetch]);

  const resetPaymentState = useCallback(() => {
    setPaymentState({ status: 'idle' });
  }, []);

  return {
    paymentState,
    resetPaymentState,
    x402Fetch,
    payBounty,
    runAgentWithPayment,
  };
}

export default useX402Payment;
