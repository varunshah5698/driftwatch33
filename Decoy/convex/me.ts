import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

/**
 * The signed-in identity, read straight from Convex Auth. The Next side posts
 * its own cookie minting on top of this, so this is the only Convex function
 * the app needs.
 */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { name: user.name ?? null, email: user.email ?? null, image: user.image ?? null };
  },
});
