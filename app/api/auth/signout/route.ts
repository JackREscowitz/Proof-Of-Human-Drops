// POST /api/auth/signout — clear the World ID sign-in session cookie.
import { clearSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSessionCookie();
  return Response.json({ ok: true, signedIn: false });
}
