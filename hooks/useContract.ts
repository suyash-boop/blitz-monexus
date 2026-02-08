'use client';

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAuth } from './useAuth';
import {
  getBountyEscrowContract,
  parseBounty,
  parseWinner,
  parseMONAmount,
  ContractBounty,
  ContractWinner,
} from '@/lib/contract';

interface TransactionState {
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  hash?: string;
  error?: string;
}

export function useContract() {
  const { getSigner, getProvider, isConnected } = useAuth();
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });

  // Get read-only contract instance
  const getReadContract = useCallback(async () => {
    const provider = await getProvider();
    return getBountyEscrowContract(provider);
  }, [getProvider]);

  // Get write contract instance (with signer)
  const getWriteContract = useCallback(async () => {
    const signer = await getSigner();
    return getBountyEscrowContract(signer);
  }, [getSigner]);

  // Create a new bounty
  const createBounty = useCallback(
    async (
      deadline: Date,
      maxWinners: number,
      splitEqually: boolean,
      amountMON: string
    ): Promise<{ bountyId: bigint; txHash: string } | null> => {
      if (!isConnected) throw new Error('Wallet not connected');

      setTxState({ status: 'pending' });

      try {
        const contract = await getWriteContract();
        const deadlineTimestamp = Math.floor(deadline.getTime() / 1000);
        const amount = parseMONAmount(amountMON);

        const tx = await contract.createBounty(
          deadlineTimestamp,
          maxWinners,
          splitEqually,
          { value: amount }
        );

        setTxState({ status: 'confirming', hash: tx.hash });

        const receipt = await tx.wait();

        // Parse BountyCreated event to get bountyId
        const event = receipt.logs.find((log: any) => {
          try {
            const parsed = contract.interface.parseLog(log);
            return parsed?.name === 'BountyCreated';
          } catch {
            return false;
          }
        });

        let bountyId = BigInt(0);
        if (event) {
          const parsed = contract.interface.parseLog(event);
          bountyId = parsed?.args?.bountyId || BigInt(0);
        }

        setTxState({ status: 'success', hash: tx.hash });
        return { bountyId, txHash: tx.hash };
      } catch (error: any) {
        setTxState({ status: 'error', error: error.message });
        throw error;
      }
    },
    [getWriteContract, isConnected]
  );

  // Select winners for a bounty
  const selectWinners = useCallback(
    async (
      bountyId: number,
      winners: string[],
      amountsMON: string[]
    ): Promise<string> => {
      if (!isConnected) throw new Error('Wallet not connected');

      setTxState({ status: 'pending' });

      try {
        const contract = await getWriteContract();
        const amounts = amountsMON.map((a) => parseMONAmount(a));

        const tx = await contract.selectWinners(bountyId, winners, amounts);
        setTxState({ status: 'confirming', hash: tx.hash });

        await tx.wait();
        setTxState({ status: 'success', hash: tx.hash });
        return tx.hash;
      } catch (error: any) {
        setTxState({ status: 'error', error: error.message });
        throw error;
      }
    },
    [getWriteContract, isConnected]
  );

  // Execute payout
  const executePayout = useCallback(
    async (bountyId: number): Promise<string> => {
      if (!isConnected) throw new Error('Wallet not connected');

      setTxState({ status: 'pending' });

      try {
        const contract = await getWriteContract();
        const tx = await contract.executePayout(bountyId);
        setTxState({ status: 'confirming', hash: tx.hash });

        await tx.wait();
        setTxState({ status: 'success', hash: tx.hash });
        return tx.hash;
      } catch (error: any) {
        setTxState({ status: 'error', error: error.message });
        throw error;
      }
    },
    [getWriteContract, isConnected]
  );

  // Cancel bounty
  const cancelBounty = useCallback(
    async (bountyId: number): Promise<string> => {
      if (!isConnected) throw new Error('Wallet not connected');

      setTxState({ status: 'pending' });

      try {
        const contract = await getWriteContract();
        const tx = await contract.cancelBounty(bountyId);
        setTxState({ status: 'confirming', hash: tx.hash });

        await tx.wait();
        setTxState({ status: 'success', hash: tx.hash });
        return tx.hash;
      } catch (error: any) {
        setTxState({ status: 'error', error: error.message });
        throw error;
      }
    },
    [getWriteContract, isConnected]
  );

  // Raise dispute
  const raiseDispute = useCallback(
    async (bountyId: number): Promise<string> => {
      if (!isConnected) throw new Error('Wallet not connected');

      setTxState({ status: 'pending' });

      try {
        const contract = await getWriteContract();
        const tx = await contract.raiseDispute(bountyId);
        setTxState({ status: 'confirming', hash: tx.hash });

        await tx.wait();
        setTxState({ status: 'success', hash: tx.hash });
        return tx.hash;
      } catch (error: any) {
        setTxState({ status: 'error', error: error.message });
        throw error;
      }
    },
    [getWriteContract, isConnected]
  );

  // Read bounty data
  const getBounty = useCallback(
    async (bountyId: number): Promise<ContractBounty | null> => {
      try {
        const contract = await getReadContract();
        const bounty = await contract.getBounty(bountyId);
        return parseBounty(bounty);
      } catch (error) {
        console.error('Failed to get bounty:', error);
        return null;
      }
    },
    [getReadContract]
  );

  // Get winners
  const getWinners = useCallback(
    async (bountyId: number): Promise<ContractWinner[]> => {
      try {
        const contract = await getReadContract();
        const winners = await contract.getWinners(bountyId);
        return winners.map(parseWinner);
      } catch (error) {
        console.error('Failed to get winners:', error);
        return [];
      }
    },
    [getReadContract]
  );

  // Check if user has submitted
  const hasSubmitted = useCallback(
    async (bountyId: number, address: string): Promise<boolean> => {
      try {
        const contract = await getReadContract();
        return await contract.hasContributorSubmitted(bountyId, address);
      } catch (error) {
        console.error('Failed to check submission:', error);
        return false;
      }
    },
    [getReadContract]
  );

  // Reset transaction state
  const resetTxState = useCallback(() => {
    setTxState({ status: 'idle' });
  }, []);

  return {
    // Transaction state
    txState,
    resetTxState,

    // Write functions
    createBounty,
    selectWinners,
    executePayout,
    cancelBounty,
    raiseDispute,

    // Read functions
    getBounty,
    getWinners,
    hasSubmitted,
  };
}

export default useContract;
