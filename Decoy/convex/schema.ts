import { authTables } from "@convex-dev/auth/server";
import { defineSchema } from "convex/server";

// Convex holds identity only — agents, alerts and telemetry stay in the local
// store — so the auth tables are the whole schema.
const schema = defineSchema({
  ...authTables,
});

export default schema;
