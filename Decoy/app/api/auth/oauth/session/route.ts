import { NextResponse } from "next/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { payloadFor, sessionCookie } from "@/lib/auth/session";
import { provisionSsoUser } from "@/lib/store";
import { isSameOrigin, jsonError, noStore, rateLimit } from "@/lib/http";
import { log } from "@/lib/observability";

/**
 * Turn a verified Convex Auth session into a Driftwatch session cookie.
 *
 * By the time /oauth/callback posts here, the middleware has already exchanged
 * the Google code for Convex's own session cookies. We read the identity back
 * from Convex — never from the client — then provision the local account and
 * sign our cookie, which stays the session of record for the console.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return jsonError("Google sign-in is not configured on this deployment.", 503);
  }

  const limit = rateLimit(clientKeySafe(request), 20, 5 * 60_000);
  if (!limit.allowed) return jsonError("Too many sign-in attempts. Try again later.", 429);

  const token = await convexAuthNextjsToken();
  if (!token) {
    log("warn", "auth.sso_rejected", { reason: "no-convex-session" });
    return jsonError("Google identity could not be verified. Try signing in again.", 401);
  }

  const viewer = await fetchQuery(api.me.viewer, {}, { token });
  if (!viewer?.email) {
    log("warn", "auth.sso_rejected", { reason: "no-email" });
    return jsonError("Google identity could not be verified.", 401);
  }

  const user = provisionSsoUser({
    email: viewer.email,
    name: viewer.name ?? viewer.email.split("@")[0],
    provider: "google",
  });
  log("info", "auth.sso_signin", { userId: user.id, provider: "google" });

  const response = NextResponse.json({
    ok: true,
    user: { name: user.name, role: user.role, email: user.email },
  });
  const cookie = sessionCookie(payloadFor(user));
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return noStore(response);
}

// Small local helper so the import list stays focused on what this route uses.
function clientKeySafe(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `oauth:${forwarded ?? "local"}`;
}
