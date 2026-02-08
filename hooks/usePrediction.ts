'use client';

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAuth } from './useAuth';
import {
  getPredictionGameContract,
  parseRound,
  parseBetInfo,
  ContractRound,
  ContractBetInfo,
} from '@/lib/prediction-contract';
import { parseMONAmount } from '@/lib/contract';

interface TransactionState {
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  hash?: string;
  error?: string;
}

export function usePrediction() {
  const { getSigner, getProvider, isConnected } = useAuth();
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });

  const getReadContract = useCallback(async () => {
    const provider = await getProvider();
    return getPredictionGameContract(provider);
  }, [getProvider]);

  const getWriteContract = useCallback(async () => {
    const signer = await getSigner();
    return getPredictionGameContract(signer);
  }, [getSigner]);

  // Bet UP on a round
  const betUp = useCallback(
    async (epoch: number, amountMON: string): Promise<string> => {
      if (!isConnected) throw new Error('Wallet not connected');
      setTxState({ status: 'pending' });
      try {
        const contract = await getWriteContract();
        const tx = await contract.betUp(epoch, { value: parseMONAmount(amountMON) });
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

  // Bet DOWN on a round
  const betDown = useCallback(
    async (epoch: number, amountMON: string): Promise<string> => {
      if (!isConnected) throw new Error('Wallet not connected');
      setTxState({ status: 'pending' });
      try {
        const contract = await getWriteContract();
        const tx = await contract.betDown(epoch, { value: parseMONAmount(amountMON) });
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

  // Claim winnings
  const claimWinnings = useCallback(
    async (epoch: number): Promise<string> => {
      if (!isConnected) throw new Error('Wallet not connected');
      setTxState({ status: 'pending' });
      try {
        const contract = await getWriteContract();
        const tx = await contract.claim(epoch);
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

  // Claim refund for cancelled round
  const claimRefund = useCallback(
    async (epoch: number): Promise<string> => {
      if (!isConnected) throw new Error('Wallet not connected');
      setTxState({ status: 'pending' });
      try {
        const contract = await getWriteContract();
        const tx = await contract.claimRefund(epoch);
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

  // Read: get round data
  const getRound = useCallback(
    async (epoch: number): Promise<ContractRound | null> => {
      try {
        const contract = await getReadContract();
        const round = await contract.getRound(epoch);
        return parseRound(round);
      } catch (error) {
        console.error('Failed to get round:', error);
        return null;
      }
    },
    [getReadContract]
  );

  // Read: get user bet
  const getUserBet = useCallback(
    async (epoch: number, address: string): Promise<ContractBetInfo | null> => {
      try {
        const contract = await getReadContract();
        const bet = await contract.getUserBet(epoch, address);
        return parseBetInfo(bet);
      } catch (error) {
        console.error('Failed to get user bet:', error);
        return null;
      }
    },
    [getReadContract]
  );

  // Read: get current epoch
  const getCurrentEpoch = useCallback(async (): Promise<number> => {
    try {
      const contract = await getReadContract();
      const epoch = await contract.currentEpoch();
      return Number(epoch);
    } catch (error) {
      console.error('Failed to get current epoch:', error);
      return 0;
    }
  }, [getReadContract]);

  // Read: check if claimable
  const checkClaimable = useCallback(
    async (epoch: number, address: string): Promise<boolean> => {
      try {
        const contract = await getReadContract();
        return await contract.claimable(epoch, address);
      } catch (error) {
        console.error('Failed to check claimable:', error);
        return false;
      }
    },
    [getReadContract]
  );

  const resetTxState = useCallback(() => {
    setTxState({ status: 'idle' });
  }, []);

  return {
    txState,
    resetTxState,
    betUp,
    betDown,
    claimWinnings,
    claimRefund,
    getRound,
    getUserBet,
    getCurrentEpoch,
    checkClaimable,
  };
}

export default usePrediction;
