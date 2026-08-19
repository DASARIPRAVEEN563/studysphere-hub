import type { ToolContext } from "@lovable.dev/mcp-js";

/** Result returned to the caller when no verified OAuth identity is present. */
export const NOT_AUTHENTICATED = {
  content: [
    {
      type: "text" as const,
      text: "Not authenticated. Sign in to StudySphere Hub and approve this client to use these tools.",
    },
  ],
  isError: true,
};

/** Returns null when the caller carries a verified token, otherwise an error result. */
export function requireSignedIn(ctx: ToolContext) {
  return ctx.isAuthenticated() ? null : NOT_AUTHENTICATED;
}
