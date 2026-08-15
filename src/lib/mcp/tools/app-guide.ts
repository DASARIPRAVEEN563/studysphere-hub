import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const GUIDES: Record<string, string> = {
  signup:
    "Create an account with your full name, registration ID (uppercase), email, department, year and semester. After signup you land on the Profile page to complete live face verification.",
  "face-verification":
    "Save your email ID on the Profile page first. Then start live face verification: the camera auto-captures when it detects a blink, and only one person may be in frame. Downloads and sharing stay locked until verification succeeds.",
  notes:
    "Browse notes by Department, then Year, then Semester, then Subject. You can search and filter by subject name, department, year and semester, view a file in the browser, download it, or like it. Each file shows view, download and like counts.",
  share:
    "Upload notes from the Share page by choosing department, year, semester and subject. Duplicate subject folder names are auto-renamed (ds becomes ds1). Each shared note earns you a star.",
  profile:
    "The Profile page shows your academic details as a read-only card with an edit icon, plus your shared count, download count and stars.",
  chat: "Students can message the admin from the Chat with Admin tab for enquiries or note requests.",
  admin:
    "The admin portal manages notes and home-page content (notices, timetables, gallery, promotions, advertisements), renames subjects, and exports student data to Excel.",
};

export default defineTool({
  name: "get_app_guide",
  title: "Get app guide",
  description:
    "Explain how a feature of StudySphere Hub works (signup, face-verification, notes, share, profile, chat, admin).",
  inputSchema: {
    topic: z
      .enum(["signup", "face-verification", "notes", "share", "profile", "chat", "admin"])
      .optional()
      .describe("Feature to explain. Omit to get every topic."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ topic }) => {
    const payload = topic ? { [topic]: GUIDES[topic] } : GUIDES;
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
