import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Convex Auth is the identity provider for Driftwatch. Google reads its client
 * id/secret from the deployment's AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET env vars;
 * nothing provider-specific lives in this repo.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
});
