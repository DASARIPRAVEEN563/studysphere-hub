import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const DEPARTMENTS = ["AMIL & CSM", "CSE", "ECE", "EEE", "MECH", "CIVIL"] as const;
const YEARS = ["1 Year", "2 Year", "3 Year", "4 Year"] as const;
const SEMESTERS = ["1 Sem", "2 Sem"] as const;

export default defineTool({
  name: "list_catalog",
  title: "List notes catalog structure",
  description:
    "List the departments, years and semesters used to organise notes in StudySphere Hub.",
  inputSchema: {
    department: z
      .string()
      .optional()
      .describe("Optional department name to filter the result to one department."),
  },
  outputSchema: undefined as never,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ department }) => {
    const departments = department
      ? DEPARTMENTS.filter((d) => d.toLowerCase().includes(department.toLowerCase()))
      : [...DEPARTMENTS];
    const payload = { departments, years: [...YEARS], semesters: [...SEMESTERS] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
