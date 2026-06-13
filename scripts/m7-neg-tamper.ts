// Negative test: a TAMPERED AgentKit signature must be rejected by enter_draw (proves the
// signature verification is genuinely enforced, not just header-presence).
import "dotenv/config";
import { buildAgentkitHeader } from "@/lib/agentkit-client";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Hex } from "viem";

async function main() {
  const MCP = `${(process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/mcp`;
  const raw = process.env.DEMO_AGENT2_PK!;
  const pk = (raw.startsWith("0x") ? raw : "0x" + raw) as Hex;
  const { header } = await buildAgentkitHeader({ privateKey: pk, resourceUri: MCP });
  const obj = JSON.parse(Buffer.from(header, "base64").toString());
  obj.signature = obj.signature.slice(0, -4) + (obj.signature.endsWith("aaaa") ? "bbbb" : "aaaa");
  const tampered = Buffer.from(JSON.stringify(obj)).toString("base64");
  const t = new StreamableHTTPClientTransport(new URL(MCP), {
    requestInit: { headers: { "x-agentkit-payload": tampered } },
  });
  const c = new Client({ name: "neg", version: "1" });
  await c.connect(t);
  const r: any = await c.callTool({ name: "enter_draw", arguments: { drop_id: "00000000-0000-0000-0000-000000000000" } });
  const txt = JSON.stringify(r);
  const rejected = !!r.isError && /signature_invalid|signature verification failed|payment_required/i.test(txt);
  console.log("tampered-sig isError =", !!r.isError, "| rejected as invalid sig:", rejected);
  await c.close();
  process.exit(rejected ? 0 : 1);
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
