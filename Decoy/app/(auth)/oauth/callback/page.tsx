"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { convexConfigured } from "@/app/ConvexClientProvider";

type Phase = "working" | "failed";

// Raw arrival diagnostics — the OAuth chain has several hops and this makes any
// future failure pinpointable from the screen. Token-bearing params are
// redacted: these screenshots end up in bug reports and chat windows.
const SECRET_PARAM = /^(access_token|refresh_token|provider_token|id_token|code)$/;
function describeArrival(raw: string): string {
  const entries = [...new URLSearchParams(raw.replace(/^[#?]/, "")).entries()];
  if (!entries.length) return "(empty)";
  return entries.map(([key, value]) => `${key}=${SECRET_PARAM.test(key) ? "<redacted>" : value}`).join("&");
}

/**
 * OAuth landing pad. Convex Auth swaps the Google code for its own session
 * cookie while the request passes through middleware; here we hand that
 * identity to /api/auth/oauth/session, which re-verifies it server-side before
 * issuing the Driftwatch cookie.
 */
function CallbackInner() {
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      if (!convexConfigured) {
        setMessage(
          "Google sign-in is not configured. Set NEXT_PUBLIC_CONVEX_URL and deploy the Convex functions in convex/.",
        );
        setPhase("failed");
        return;
      }

      // OAuth failures arrive as query params — or, for some providers, in the
      // hash. A bare `error` with no description is common when the consent
      // step is cancelled or blocked upstream.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const arriving = (key: string) => params.get(key) ?? hash.get(key);
      const oauthError = arriving("error");
      const oauthErrorCode = arriving("error_code");
      const errorDescription = arriving("error_description");
      if (oauthError || oauthErrorCode) {
        setPhase("failed");
        setMessage(
          errorDescription ||
            `Google sign-in was rejected upstream${oauthError ? `: ${oauthError}` : ""}${oauthErrorCode ? ` (${oauthErrorCode})` : ""}.`,
        );
        return;
      }

      // The middleware already swapped the incoming code for a Convex session;
      // all that is left is turning that into our own signed cookie.
      const response = await fetch("/api/auth/oauth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setPhase("failed");
        setMessage(payload.error ?? "Could not start your Driftwatch session.");
        return;
      }

      // Our own signed, HttpOnly cookie is the session of record for the console.
      window.location.assign("/overview");
    };

    void run();
  }, [params]);

  if (phase === "working") {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Loader2 size={26} className="animate-spin text-[var(--lime)]" aria-hidden />
        <p className="text-[13px] text-[var(--muted)]">Verifying your Google identity…</p>
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[var(--red-soft)] p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[var(--red)]" aria-hidden />
          <div>
            <p className="text-[13px] font-semibold">Could not complete Google sign-in</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-soft)]">{message}</p>
            {/* Raw arrival diagnostics — the OAuth chain has several hops and
                this makes any future failure pinpointable from the screen. */}
            <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--panel)] p-2.5 text-[10px] leading-relaxed text-[var(--muted)]">
{`path: ${window.location.pathname}
query: ${describeArrival(window.location.search)}
hash: ${describeArrival(window.location.hash)}`}
            </pre>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/login" className="btn btn-primary !h-10 !text-[12.5px]">
          Back to sign in
        </Link>
        <Link href="/signup" className="btn !h-10 !text-[12.5px]">
          Create an account instead
        </Link>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="mx-auto max-w-[520px] px-4 py-12">
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 size={26} className="animate-spin text-[var(--lime)]" aria-hidden />
          </div>
        }
      >
        <CallbackInner />
      </Suspense>
    </div>
  );
}
