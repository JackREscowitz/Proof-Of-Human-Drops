// Demo seed (M3 / M11): the two live drops — Mac Mini + GeForce RTX 5090.
//
// SNKRS-style staging (M14): each drop is seeded as `coming_soon` with a future `opens_at`
// and a `closes_at` = opens_at + entry window. The real M11 lifecycle clock then drives the
// whole flow with zero admin input:
//   LAUNCHING IN <opens_at> → (auto) ENTRIES CLOSE IN <closes_at> → (auto) draw → WON / SOLD OUT.
// Launch offsets are staggered so both timers are visible at once and open during a demo.
//
// IMPORTANT (M11): each drop's World ID v4 action (`drop_<uuid>`) is registered in the
// Developer Portal against that drop's UUID. So we do NOT blow drops away — that would mint
// new UUIDs whose actions aren't registered, breaking the live entry flow. Instead we
// UPSERT in place, preserving each drop's id + worldActionId.
// On a fresh DB (no rows) it falls back to creating both cleanly.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, variants } from "@/lib/db/schema";
import {
  createDrop,
  findDropByName,
  stagingFor,
  type DropWithVariants,
} from "@/lib/drops.service";
import { getDropWithVariants } from "@/lib/drops.service";

const MAC_MINI = "Mac Mini";
const RTX_5090 = "GeForce RTX 5090";
const MAC_STUDIO = "Mac Studio"; // legacy name we migrate away from

async function replaceVariants(
  dropId: string,
  rows: Array<{ name: string; sku: string; stock: number }>,
): Promise<void> {
  await db.delete(variants).where(eq(variants.dropId, dropId));
  await db.insert(variants).values(rows.map((r) => ({ dropId, ...r })));
}

export async function seedDemo(): Promise<DropWithVariants[]> {
  const now = Date.now();
  const macStaging = stagingFor(MAC_MINI, now);
  const rtxStaging = stagingFor(RTX_5090, now);

  // ---- Mac Mini: keep if present (preserve UUID + action), else create. ----
  // Staged coming_soon → opens in ~2 min → 10-min entry window → draw.
  let macMini = await findDropByName(MAC_MINI);
  if (!macMini) {
    macMini = await createDrop({
      name: MAC_MINI,
      status: "coming_soon",
      opensAt: macStaging.opensAt,
      closesAt: macStaging.closesAt,
      totalSlots: 1,
      priceUsdc: "10",
      variants: [
        { name: "Silver", sku: "MACMINI-SLV", stock: 1 },
        { name: "Black", sku: "MACMINI-BLK", stock: 1 },
      ],
    });
  } else {
    await db
      .update(drops)
      .set({
        status: "coming_soon",
        opensAt: macStaging.opensAt,
        closesAt: macStaging.closesAt,
        drawnAt: null,
        priceUsdc: "10",
        totalSlots: 1,
      })
      .where(eq(drops.id, macMini.id));
    await replaceVariants(macMini.id, [
      { name: "Silver", sku: "MACMINI-SLV", stock: 1 },
      { name: "Black", sku: "MACMINI-BLK", stock: 1 },
    ]);
  }

  // ---- GeForce RTX 5090: reuse the old Mac Studio row (registered action), else the ----
  // existing 5090 row, else create fresh. Staged coming_soon → opens in ~3 min.
  let rtx =
    (await findDropByName(RTX_5090)) ?? (await findDropByName(MAC_STUDIO)) ?? null;
  if (!rtx) {
    rtx = await createDrop({
      name: RTX_5090,
      status: "coming_soon",
      opensAt: rtxStaging.opensAt,
      closesAt: rtxStaging.closesAt,
      totalSlots: 1,
      priceUsdc: "50",
      variants: [{ name: "Founders Edition", sku: "RTX5090-FE", stock: 1 }],
    });
  } else {
    await db
      .update(drops)
      .set({
        name: RTX_5090,
        status: "coming_soon",
        opensAt: rtxStaging.opensAt,
        closesAt: rtxStaging.closesAt,
        drawnAt: null,
        priceUsdc: "50",
        totalSlots: 1,
      })
      .where(eq(drops.id, rtx.id));
    await replaceVariants(rtx.id, [
      { name: "Founders Edition", sku: "RTX5090-FE", stock: 1 },
    ]);
  }

  const a = await getDropWithVariants(macMini.id);
  const b = await getDropWithVariants(rtx.id);
  return [a!, b!];
}
