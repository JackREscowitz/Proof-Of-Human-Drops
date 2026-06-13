// POST /api/admin/drops/:id/:action — per-drop lifecycle ops. Auth-gated (M3).
// Actions: open | close | settle | reset | flip | seed | add-variant | dummy-entry
//   - open/close/settle: status transitions (coming_soon→open→closed→settled).
//   - reset: truncate entries+orders for this drop, re-open, reset countdown.
//   - flip: coming_soon ↔ open (the second-item reveal).
//   - seed: set/clear the RNG seed ({ seed: string|null }).
//   - add-variant: { name, sku?, stock? }.
//   - dummy-entry: { humanKey, variantId? } — for the reset acceptance test / dev seeding.
import { NextRequest } from "next/server";
import { isAuthorized, unauthorized } from "@/lib/admin-auth";
import {
  transitionStatus,
  resetDrop,
  flipComingSoon,
  setSeed,
  addVariant,
  insertDummyEntry,
  getDropWithVariants,
  NotFoundError,
  InvalidTransitionError,
} from "@/lib/drops.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; action: string }> };

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!isAuthorized(req)) return unauthorized();
  const { id, action } = await ctx.params;

  try {
    switch (action) {
      case "open":
        return Response.json({ ok: true, drop: await transitionStatus(id, "open") });
      case "close":
        return Response.json({ ok: true, drop: await transitionStatus(id, "closed") });
      case "settle":
        return Response.json({ ok: true, drop: await transitionStatus(id, "settled") });
      case "flip":
        return Response.json({ ok: true, drop: await flipComingSoon(id) });
      case "reset": {
        const body = await readBody(req);
        const countdownSeconds =
          typeof body.countdownSeconds === "number"
            ? body.countdownSeconds
            : body.countdownSeconds === null
              ? null
              : undefined;
        const drop = await resetDrop(id, { countdownSeconds });
        return Response.json({ ok: true, drop });
      }
      case "seed": {
        const body = await readBody(req);
        const seed = body.seed === null ? null : String(body.seed ?? "");
        return Response.json({ ok: true, drop: await setSeed(id, seed || null) });
      }
      case "add-variant": {
        const body = await readBody(req);
        if (!body.name) return Response.json({ error: "name required" }, { status: 400 });
        const variant = await addVariant(id, {
          name: String(body.name),
          sku: body.sku ? String(body.sku) : null,
          stock: typeof body.stock === "number" ? body.stock : 0,
        });
        return Response.json({ ok: true, variant }, { status: 201 });
      }
      case "dummy-entry": {
        const body = await readBody(req);
        if (!body.humanKey)
          return Response.json({ error: "humanKey required" }, { status: 400 });
        await insertDummyEntry(
          id,
          String(body.humanKey),
          body.variantId ? String(body.variantId) : null,
        );
        const drop = await getDropWithVariants(id);
        return Response.json({ ok: true, drop }, { status: 201 });
      }
      default:
        return Response.json({ error: `unknown action: ${action}` }, { status: 404 });
    }
  } catch (err) {
    if (err instanceof NotFoundError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof InvalidTransitionError) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    console.error(`[admin/drops/${id}/${action}] error:`, err);
    return Response.json(
      { error: err instanceof Error ? err.message : "internal error" },
      { status: 500 },
    );
  }
}
