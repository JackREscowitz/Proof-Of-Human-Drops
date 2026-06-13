// POST /api/worldid/rp-context (M4) — mint a server-signed rp_context for a drop's
// World ID v4 action. The browser calls this right before opening the IDKit widget.
// The RP signing key stays server-side; only the signed context crosses to the client.
//
// Body: { dropId: string }  →  { rp_context, app_id, action }
import { NextRequest } from "next/server";
import { getDrop } from "@/lib/drops.service";
import { mintRpContext, getAppId } from "@/lib/worldid.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { dropId?: string };
  try {
    body = (await req.json()) as { dropId?: string };
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const dropId = body.dropId;
  if (!dropId) return Response.json({ error: "dropId required" }, { status: 400 });

  const drop = await getDrop(dropId);
  if (!drop) return Response.json({ error: "drop not found" }, { status: 404 });
  if (drop.status !== "open") {
    return Response.json(
      { error: `drop is ${drop.status}, not open for entry` },
      { status: 409 },
    );
  }
  const action = drop.worldActionId;
  if (!action) {
    return Response.json(
      { error: "drop has no World ID action configured" },
      { status: 409 },
    );
  }

  try {
    const rp_context = mintRpContext(action);
    return Response.json({ rp_context, app_id: getAppId(), action });
  } catch (err) {
    console.error("[worldid/rp-context] mint error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "failed to mint rp_context" },
      { status: 500 },
    );
  }
}
