// M5 acceptance — a REAL 10-USDC transfer on World Chain Sepolia (chain 4801) between two
// funded demo wallets, confirmed on-chain and recorded in `orders` with an explorer link.
// Drives the production settlement service (the same code /api/admin/test-transfer uses).
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { transferUsdc, getBalances } from "@/lib/settlement.service";
import { getWallet } from "@/lib/wallets";
import { CHAIN_ID } from "@/lib/chain";

let failures = 0;
function ok(cond: boolean, label: string) {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

async function main() {
  console.log(`M5 acceptance — real 10 USDC transfer on chain ${CHAIN_ID}\n`);

  const sender = getWallet("agent1");
  const recipient = getWallet("agent2");

  const beforeFrom = await getBalances(sender.address);
  const beforeTo = await getBalances(recipient.address);
  console.log(`sender   ${sender.address}  ${beforeFrom.usdc} USDC  ${beforeFrom.eth} ETH`);
  console.log(`recipient ${recipient.address}  ${beforeTo.usdc} USDC  ${beforeTo.eth} ETH\n`);

  ok(Number(beforeFrom.usdc) >= 10, "sender has >= 10 USDC");
  ok(Number(beforeFrom.eth) > 0, "sender has ETH for gas");

  console.log("sending 10 USDC agent1 → agent2 …");
  const result = await transferUsdc({
    privateKey: sender.privateKey,
    to: recipient.address,
    amount: "10", // 10 USDC = 10_000_000 raw
    recordOrder: true,
  });

  console.log("  txHash:", result.txHash);
  console.log("  explorer:", result.explorerUrl);
  console.log("  status:", result.status, "| orderId:", result.orderId, "\n");

  ok(result.status === "confirmed", "transfer confirmed on-chain (receipt status success)");
  ok(/^0x[0-9a-fA-F]{64}$/.test(result.txHash), "tx hash is a valid 32-byte hash");
  ok(result.amountUsdc === "10", "amount transferred == 10 USDC");
  ok(!!result.orderId, "orders row recorded");

  // Verify the orders row reflects the settlement.
  if (result.orderId) {
    const [row] = await db.select().from(orders).where(eq(orders.id, result.orderId));
    ok(!!row, "orders row exists in DB");
    ok(row.txHash === result.txHash, "orders.tx_hash matches the on-chain tx");
    ok(row.status === "confirmed", "orders.status == 'confirmed'");
    ok(row.amountUsdc === "10.000000", "orders.amount_usdc == 10.000000");
    ok(row.fromAddress === sender.address, "orders.from_address == sender");
    ok(row.toAddress === recipient.address, "orders.to_address == recipient");
  }

  // Confirm the balances actually moved (10 USDC). Read pinned to the mined block and the
  // block just before it — deterministic regardless of public-RPC read-after-write lag.
  const blk = result.blockNumber;
  const preFrom = await getBalances(sender.address, blk - BigInt(1));
  const preTo = await getBalances(recipient.address, blk - BigInt(1));
  const postFrom = await getBalances(sender.address, blk);
  const postTo = await getBalances(recipient.address, blk);
  const fromDelta = Number(preFrom.usdc) - Number(postFrom.usdc);
  const toDelta = Number(postTo.usdc) - Number(preTo.usdc);
  ok(Math.abs(fromDelta - 10) < 1e-9, `sender USDC decreased by 10 across the tx block (Δ=${fromDelta})`);
  ok(Math.abs(toDelta - 10) < 1e-9, `recipient USDC increased by 10 across the tx block (Δ=${toDelta})`);

  console.log(`\nM5_ACCEPTANCE: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
  console.log(`VERIFY: ${result.explorerUrl}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
