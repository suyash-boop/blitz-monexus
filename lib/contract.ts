import { ethers } from 'ethers';

// Contract address - set after deployment
export const BOUNTY_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS || '';

// Contract ABI (simplified for client-side use)
export const BOUNTY_ESCROW_ABI = [
  // Read functions
  'function getBounty(uint256 bountyId) view returns (tuple(address creator, uint256 amount, uint256 deadline, uint256 maxWinners, uint8 status, uint256 remainingAmount, bool splitEqually))',
  'function getWinners(uint256 bountyId) view returns (tuple(address winner, uint256 amount, bool paid)[])',
  'function getWinnerCount(uint256 bountyId) view returns (uint256)',
  'function hasContributorSubmitted(uint256 bountyId, address contributor) view returns (bool)',
  'function getStats() view returns (uint256 totalBounties, uint256 totalPaid, uint256 currentFee)',
  'function bountyCounter() view returns (uint256)',
  'function platformFee() view returns (uint256)',
  'function contributorEarnings(address) view returns (uint256)',
  'function creatorBountyCount(address) view returns (uint256)',

  // Write functions
  'function createBounty(uint256 deadline, uint256 maxWinners, bool splitEqually) payable returns (uint256)',
  'function addFunds(uint256 bountyId) payable',
  'function registerSubmission(uint256 bountyId, address contributor)',
  'function selectWinners(uint256 bountyId, address[] winners, uint256[] amounts)',
  'function executePayout(uint256 bountyId)',
  'function cancelBounty(uint256 bountyId)',
  'function raiseDispute(uint256 bountyId)',

  // Events
  'event BountyCreated(uint256 indexed bountyId, address indexed creator, uint256 amount, uint256 deadline, uint256 maxWinners)',
  'event WinnerSelected(uint256 indexed bountyId, address indexed winner, uint256 amount)',
  'event PayoutExecuted(uint256 indexed bountyId, address indexed winner, uint256 amount)',
  'event BountyCancelled(uint256 indexed bountyId, uint256 refundAmount)',
  'event DisputeRaised(uint256 indexed bountyId, address indexed disputant)',
  'event DisputeResolved(uint256 indexed bountyId, bool inFavorOfContributor)',
];

// Bounty status enum matching the contract
export enum BountyStatus {
  Active = 0,
  Completed = 1,
  Cancelled = 2,
  Disputed = 3,
}

export function getStatusLabel(status: number): string {
  switch (status) {
    case BountyStatus.Active:
      return 'OPEN';
    case BountyStatus.Completed:
      return 'COMPLETED';
    case BountyStatus.Cancelled:
      return 'CANCELLED';
    case BountyStatus.Disputed:
      return 'DISPUTED';
    default:
      return 'UNKNOWN';
  }
}

// Helper to create contract instance
export function getBountyEscrowContract(
  signerOrProvider: ethers.Signer | ethers.Provider
): ethers.Contract {
  if (!BOUNTY_ESCROW_ADDRESS) {
    throw new Error('BOUNTY_ESCROW_ADDRESS not configured');
  }
  return new ethers.Contract(BOUNTY_ESCROW_ADDRESS, BOUNTY_ESCROW_ABI, signerOrProvider);
}

// Helper to parse bounty from contract response
export interface ContractBounty {
  creator: string;
  amount: bigint;
  deadline: bigint;
  maxWinners: bigint;
  status: number;
  remainingAmount: bigint;
  splitEqually: boolean;
}

export function parseBounty(bounty: any): ContractBounty {
  return {
    creator: bounty.creator,
    amount: BigInt(bounty.amount),
    deadline: BigInt(bounty.deadline),
    maxWinners: BigInt(bounty.maxWinners),
    status: Number(bounty.status),
    remainingAmount: BigInt(bounty.remainingAmount),
    splitEqually: bounty.splitEqually,
  };
}

// Helper to parse winner from contract response
export interface ContractWinner {
  winner: string;
  amount: bigint;
  paid: boolean;
}

export function parseWinner(winner: any): ContractWinner {
  return {
    winner: winner.winner,
    amount: BigInt(winner.amount),
    paid: winner.paid,
  };
}

// Format MON amount (18 decimals)
export function formatMONAmount(amount: bigint): string {
  return ethers.formatEther(amount);
}

// Parse MON amount to wei
export function parseMONAmount(amount: string): bigint {
  return ethers.parseEther(amount);
}
