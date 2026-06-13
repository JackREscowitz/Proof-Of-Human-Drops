// World Chain Sepolia (chain 4801) config + viem clients (M5).
// Ground truth (RALPH_GUIDE.md §5 / demo_wallets.md): chain id 4801 (NOT 480 mainnet),
// RPC https://worldchain-sepolia.g.alchemy.com/public, explorer https://sepolia.worldscan.org,
// USDC 0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88 (Bridged USDC.e, 6 decimals).

import { createPublicClient, createWalletClient, http, getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { worldchainSepolia } from "viem/chains";

export const CHAIN = worldchainSepolia; // id 4801
export const CHAIN_ID = 4801 as const;
export const EXPLORER = "https://sepolia.worldscan.org";

// Bridged USDC.e on World Chain Sepolia. 6 decimals — $10 = 10_000_000 raw.
export const USDC_ADDRESS = getAddress("0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88");
export const USDC_DECIMALS = 6;

export function rpcUrl(): string {
  return (
    process.env.WORLD_CHAIN_SEPOLIA_RPC ||
    "https://worldchain-sepolia.g.alchemy.com/public"
  );
}

export function publicClient() {
  return createPublicClient({ chain: CHAIN, transport: http(rpcUrl()) });
}

export function walletClientFromKey(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  return {
    client: createWalletClient({ account, chain: CHAIN, transport: http(rpcUrl()) }),
    account,
  };
}

export function explorerTxUrl(txHash: string): string {
  return `${EXPLORER}/tx/${txHash}`;
}

// Minimal ERC-20 ABI: balanceOf + transfer (+ decimals for sanity).
export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;
