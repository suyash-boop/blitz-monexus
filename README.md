# Monexus

A Monad-native community platform that combines social features, on-chain bounties, price predictions, and an autonomous AI agent — all powered by the Monad blockchain.

## Features

### Social Feed
- Create posts with text, images, and link previews
- Like and comment system with nested replies
- User profiles with on-chain reputation tracking

### On-Chain Bounty System
- Post bounties with MON rewards locked in a smart contract escrow
- Contributors submit solutions; bounty creators approve winners
- Automated payouts with configurable platform fees
- Dispute resolution with an arbiter role
- Support for multiple winners with equal or custom splits

### Price Prediction Game
- Predict whether MON/USD goes UP or DOWN in 5-minute rounds
- Place bets during a 2.5-minute betting window
- Prize pool distributed to winners proportionally
- Claim winnings directly from the smart contract

### AI Agent
- Autonomous agent that scans open bounties and generates submissions using Groq LLM (Llama 3.3 70B)
- AI-powered bounty enhancement — auto-generates titles, descriptions, requirements, and tags from a rough description
- Protected by x402 micropayment protocol with ZK proof verification

### Notifications
- Real-time notifications for bounty wins, likes, comments, and new submissions

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (Neon serverless) via Prisma ORM |
| Blockchain | Monad Testnet (Chain ID 10143) |
| Web3 | ethers.js 6, Hardhat 3 |
| Auth | Privy (wallet + social login) |
| AI | Groq SDK + Vercel AI SDK |
| File Storage | Uploadthing |
| Validation | Zod |

## Smart Contracts

### BountyEscrow.sol
Handles bounty lifecycle — creation, submission registration, winner selection, escrow payouts, cancellations, and disputes. Uses OpenZeppelin's `ReentrancyGuard` and `Pausable`.

### PredictionGame.sol
Manages prediction rounds — starting rounds with a lock price, accepting UP/DOWN bets, resolving with a close price, and distributing winnings. Includes treasury fee collection and refund mechanisms.

Both contracts are written in Solidity 0.8.20 and compiled with Hardhat.

## Getting Started

### Prerequisites
- Node.js 18+
- A PostgreSQL database (Neon recommended)
- A Monad Testnet wallet with test MON

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://...

# Privy Auth
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_secret

# Monad Network
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_MONAD_CHAIN_ID=10143
NEXT_PUBLIC_MONAD_EXPLORER_URL=https://testnet.monadexplorer.com

# Deployed Contracts
NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_PREDICTION_GAME_ADDRESS=0x...
DEPLOYER_PRIVATE_KEY=0x...

# Uploadthing
UPLOADTHING_TOKEN=your_uploadthing_token

# Groq AI
GROQ_API_KEY=your_groq_api_key

# AI Agent
AI_AGENT_WALLET_ADDRESS=0x...
```

### 3. Initialize the database

```bash
npx prisma generate
npx prisma db push
```

### 4. Deploy smart contracts (optional — if not already deployed)

```bash
npx hardhat run scripts/deploy.ts --network monad
npx hardhat run scripts/deploy-prediction.ts --network monad
```

Copy the printed contract addresses into your `.env` file.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Project Structure

```
app/                    Next.js App Router (pages + API routes)
  api/                  19 REST endpoints
  feed/                 Social feed
  bounties/             Bounty listing, creation, details
  predictions/          Prediction game
  agent/                AI agent dashboard
  profile/              User profiles
components/             React components
  ui/                   Reusable primitives (Card, Button, Modal, etc.)
  layout/               Header, Sidebar, MobileNav
  posts/                Post creation and display
  bounties/             Bounty cards and forms
  predictions/          Betting UI, carousel, history
  notifications/        Notification bell
  auth/                 Wallet connect button
contracts/              Solidity smart contracts
hooks/                  Custom React hooks (useAuth, useContract, usePrediction)
lib/                    Utilities, contract ABIs, AI agent logic, x402 protocol
prisma/                 Database schema
config/                 Chain configuration
```

## Scripts

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

## License

MIT
