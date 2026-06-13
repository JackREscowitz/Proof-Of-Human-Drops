// Demo seed (M3): the Mac Mini live drop + a coming-soon second item.
// Idempotent — re-running won't duplicate (matches by name, recreates clean).
import { createDrop, findDropByName, deleteDrop, type DropWithVariants } from "@/lib/drops.service";
import { getDropWithVariants } from "@/lib/drops.service";

const MAC_MINI = "Mac Mini";
const MAC_STUDIO = "Mac Studio";

export async function seedDemo(): Promise<DropWithVariants[]> {
  // Clean reseed: drop existing demo drops by name so the seed is deterministic.
  for (const name of [MAC_MINI, MAC_STUDIO]) {
    const existing = await findDropByName(name);
    if (existing) await deleteDrop(existing.id);
  }

  const macMini = await createDrop({
    name: MAC_MINI,
    status: "open",
    totalSlots: 1, // instant sellout — one verified human wins
    priceUsdc: "10", // $10 USDC
    variants: [
      { name: "Silver", sku: "MACMINI-SLV", stock: 1 },
      { name: "Black", sku: "MACMINI-BLK", stock: 1 },
    ],
  });

  const macStudio = await createDrop({
    name: MAC_STUDIO,
    status: "coming_soon",
    totalSlots: 1,
    priceUsdc: "20",
    variants: [
      { name: "Silver", sku: "MACSTUDIO-SLV", stock: 1 },
      { name: "Black", sku: "MACSTUDIO-BLK", stock: 1 },
    ],
  });

  const a = await getDropWithVariants(macMini.id);
  const b = await getDropWithVariants(macStudio.id);
  return [a!, b!];
}
