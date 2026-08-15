import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const ALLOWED = [
  { extension: ".pdf", mimeType: "application/pdf" },
  { extension: ".jpg", mimeType: "image/jpeg" },
  { extension: ".jpeg", mimeType: "image/jpeg" },
  { extension: ".png", mimeType: "image/png" },
  { extension: ".webp", mimeType: "image/webp" },
];
const MAX_MB = 25;

export default defineTool({
  name: "check_upload_rules",
  title: "Check note upload rules",
  description:
    "Return the allowed file types and size limit for shared notes, and optionally validate a filename and size against them.",
  inputSchema: {
    filename: z.string().optional().describe("Filename to validate, e.g. 'unit1.pdf'."),
    sizeMb: z.number().positive().optional().describe("File size in megabytes to validate."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ filename, sizeMb }) => {
    const problems: string[] = [];
    if (filename) {
      const ok = ALLOWED.some((a) => filename.toLowerCase().endsWith(a.extension));
      if (!ok) problems.push(`Extension not allowed for "${filename}".`);
    }
    if (sizeMb !== undefined && sizeMb > MAX_MB) {
      problems.push(`File is ${sizeMb}MB, over the ${MAX_MB}MB limit.`);
    }
    const payload = {
      allowed: ALLOWED,
      maxSizeMb: MAX_MB,
      valid: problems.length === 0,
      problems,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
