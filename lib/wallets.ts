// Demo wallet registry (M5). Resolves a named demo wallet → { address, privateKey } from
// env vars (set from demo_wallets.md into .env locally + Railway). The private keys NEVER
// leave the server; routes select wallets by NAME ("agent1"|"agent2"|"human"), not by key.
import { getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type WalletName = "agent1" | "agent2" | "human" | "agent";

interface WalletEntry {
  address: string;
  privateKey: Hex;
}

function read(envKey: string): string | undefined {
  const v = process.env[envKey];
  return v && v.length > 0 ? v : undefined;
}

// Maps the friendly name → the env var holding its private key (+ optional address).
const REGISTRY: Record<WalletName, { pk: string; addr?: string }> = {
  agent1: { pk: "DEMO_AGENT1_PK", addr: "DEMO_AGENT1_ADDRESS" },
  agent2: { pk: "DEMO_AGENT2_PK", addr: "DEMO_AGENT2_ADDRESS" },
  human: { pk: "DEMO_HUMAN_PK", addr: "DEMO_HUMAN_ADDRESS" },
  // The agent wallet from secret_keys (WORLD signer is separate). Has USDC but may lack gas.
  agent: { pk: "AGENT_WALLET_PK", addr: "AGENT_WALLET_ADDRESS" },
};

export function getWallet(name: string): WalletEntry {
  const key = name.toLowerCase() as WalletName;
  const entry = REGISTRY[key];
  if (!entry) {
    throw new Error(`unknown wallet "${name}" (use agent1|agent2|human|agent)`);
  }
  const pk = read(entry.pk);
  if (!pk) throw new Error(`wallet "${name}" private key (${entry.pk}) is not configured`);
  const privateKey = (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
  // Derive the address from the key so it's always correct; fall back to the env address.
  const address = entry.addr && read(entry.addr)
    ? getAddress(read(entry.addr)!)
    : privateKeyToAccount(privateKey).address;
  return { address, privateKey };
}

export function listWalletNames(): WalletName[] {
  return (Object.keys(REGISTRY) as WalletName[]).filter((n) => read(REGISTRY[n].pk));
}
