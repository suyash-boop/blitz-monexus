import hre from "hardhat";
import { ethers } from "ethers";

async function main() {
  // Connect to network via EIP-1193 provider
  const connection = await hre.network.connect();
  const networkName = connection.networkName;
  const isLocal = networkName === "hardhat" || networkName === "localhost";
  const label = isLocal ? "Local Testnet" : "Monad Testnet";
  const currency = isLocal ? "ETH" : "MON";

  console.log(`Deploying BountyEscrow contract to ${label}...\n`);

  const provider = connection.provider as any;

  // Get accounts from provider
  const accounts: string[] = await provider.request({ method: "eth_accounts" });
  if (accounts.length === 0) {
    console.error("ERROR: No accounts available.");
    process.exit(1);
  }

  const deployerAddress = accounts[0];
  console.log("Deployer address:", deployerAddress);

  // Check balance
  const balanceHex: string = await provider.request({
    method: "eth_getBalance",
    params: [deployerAddress, "latest"],
  });
  const balance = BigInt(balanceHex);
  console.log("Balance:", ethers.formatEther(balance), `${currency}\n`);

  if (balance === 0n) {
    console.error(`ERROR: Deployer has no ${currency}.${isLocal ? "" : " Get testnet MON from a faucet."}`);
    process.exit(1);
  }

  // Contract constructor arguments
  const PLATFORM_FEE = 250n; // 2.5%
  const FEE_RECIPIENT = deployerAddress;

  console.log("Platform fee:", Number(PLATFORM_FEE) / 100, "%");
  console.log("Fee recipient:", FEE_RECIPIENT);
  console.log("\nDeploying...");

  // Read artifact
  const artifact = await hre.artifacts.readArtifact("BountyEscrow");

  // Encode constructor args
  const iface = new ethers.Interface(artifact.abi);
  const constructorData = iface.encodeDeploy([PLATFORM_FEE, FEE_RECIPIENT]);

  // Create deployment data
  const deployData = artifact.bytecode + constructorData.slice(2);

  // Send deployment transaction via EIP-1193
  const txHash: string = await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: deployerAddress,
      data: deployData,
      gas: "0x" + (3000000).toString(16),
    }],
  });

  console.log("Transaction hash:", txHash);
  console.log("Waiting for confirmation...");

  // Get transaction receipt
  let receipt: any = null;
  while (!receipt) {
    receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });
    if (!receipt) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!receipt.contractAddress) {
    throw new Error("Deployment failed - no contract address in receipt");
  }

  console.log("\n========================================");
  console.log("SUCCESS! Contract deployed!");
  console.log("========================================");
  console.log("\nContract address:", receipt.contractAddress);
  console.log("\nAdd this to your .env file:");
  console.log(`NEXT_PUBLIC_BOUNTY_ESCROW_ADDRESS=${receipt.contractAddress}`);
  console.log("\n========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
