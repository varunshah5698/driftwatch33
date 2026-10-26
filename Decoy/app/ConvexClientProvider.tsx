"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

export const convexConfigured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
const convex = convexConfigured ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL as string) : null;

/**
 * Convex Auth owns identity for the whole tree. Without a deployment the app
 * still runs — the demo sign-in is local — it just has no Google button.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
  return <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>;
}
