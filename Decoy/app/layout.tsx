import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Driftwatch · Identity drift detection for AI agents",
    template: "%s · Driftwatch",
  },
  description:
    "Driftwatch learns how autonomous AI agents behave, compares it with their declared role, and contains identity drift while credentials remain valid.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#070707",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("dw_theme")?.value === "light" ? "light" : "dark";
  // The server provider throws when the deployment is not configured, so the
  // tree is only wrapped when Convex is actually wired up. The demo sign-in
  // is local and works either way.
  const convexConfigured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const tree = (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
  if (!convexConfigured) return tree;
  return <ConvexAuthNextjsServerProvider>{tree}</ConvexAuthNextjsServerProvider>;
}
