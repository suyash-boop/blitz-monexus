import { ethers } from 'ethers';

// Contract address - set after deployment
export const PREDICTION_GAME_ADDRESS = process.env.NEXT_PUBLIC_PREDICTION_GAME_ADDRESS || '';

// Contract ABI (human-readable)
export const PREDICTION_GAME_ABI = [
  // Read functions
  'function getRound(uint256 epoch) view returns (tuple(uint256 epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp, int256 lockPrice, int256 closePrice, uint256 totalAmount, uint256 upAmount, uint256 downAmount, bool resolved, bool cancelled))',
  'function getUserBet(uint256 epoch, address user) view returns (tuple(uint8 position, uint256 amount, bool claimed))',
  'function getUserRounds(address user) view returns (uint256[])',
  'function claimable(uint256 epoch, address user) view returns (bool)',
  'function currentEpoch() view returns (uint256)',
  'function minBetAmount() view returns (uint256)',
  'function treasuryFee() view returns (uint256)',

  // Write functions
  'function startRound(int256 lockPrice)',
  'function betUp(uint256 epoch) payable',
  'function betDown(uint256 epoch) payable',
  'function resolveRound(uint256 epoch, int256 closePrice)',
  'function claim(uint256 epoch)',
  'function claimRefund(uint256 epoch)',
  'function cancelRound(uint256 epoch)',

  // Events
  'event RoundStarted(uint256 indexed epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp)',
  'event RoundLocked(uint256 indexed epoch, int256 lockPrice)',
  'event RoundResolved(uint256 indexed epoch, int256 closePrice)',
  'event RoundCancelled(uint256 indexed epoch)',
  'event BetPlaced(uint256 indexed epoch, address indexed sender, uint256 amount, uint8 position)',
  'event Claimed(uint256 indexed epoch, address indexed sender, uint256 amount)',
];

// Position enum matching contract
export enum Position {
  None = 0,
  Up = 1,
  Down = 2,
}

// Helper to create contract instance
export function getPredictionGameContract(
  signerOrProvider: ethers.Signer | ethers.Provider
): ethers.Contract {
  if (!PREDICTION_GAME_ADDRESS) {
    throw new Error('PREDICTION_GAME_ADDRESS not configured');
  }
  return new ethers.Contract(PREDICTION_GAME_ADDRESS, PREDICTION_GAME_ABI, signerOrProvider);
}

// Interface types
export interface ContractRound {
  epoch: bigint;
  startTimestamp: bigint;
  lockTimestamp: bigint;
  closeTimestamp: bigint;
  lockPrice: bigint;
  closePrice: bigint;
  totalAmount: bigint;
  upAmount: bigint;
  downAmount: bigint;
  resolved: boolean;
  cancelled: boolean;
}

export interface ContractBetInfo {
  position: number;
  amount: bigint;
  claimed: boolean;
}

export function parseRound(raw: any): ContractRound {
  return {
    epoch: BigInt(raw.epoch),
    startTimestamp: BigInt(raw.startTimestamp),
    lockTimestamp: BigInt(raw.lockTimestamp),
    closeTimestamp: BigInt(raw.closeTimestamp),
    lockPrice: BigInt(raw.lockPrice),
    closePrice: BigInt(raw.closePrice),
    totalAmount: BigInt(raw.totalAmount),
    upAmount: BigInt(raw.upAmount),
    downAmount: BigInt(raw.downAmount),
    resolved: raw.resolved,
    cancelled: raw.cancelled,
  };
}

export function parseBetInfo(raw: any): ContractBetInfo {
  return {
    position: Number(raw.position),
    amount: BigInt(raw.amount),
    claimed: raw.claimed,
  };
}
