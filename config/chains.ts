// Monad chain configuration for Privy and ethers.js

export const monadChain = {
  id: parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || '10143'),
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || 'https://testnet.monadexplorer.com'
    },
  },
};

// Chain ID for ethers.js
export const MONAD_CHAIN_ID = monadChain.id;

// RPC URL for ethers.js
export const MONAD_RPC_URL = monadChain.rpcUrls.default.http[0];
