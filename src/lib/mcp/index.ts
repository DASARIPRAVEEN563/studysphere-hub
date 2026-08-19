import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCatalogTool from "./tools/list-catalog";
import uploadRulesTool from "./tools/upload-rules";
import appGuideTool from "./tools/app-guide";

// Issuer must be the direct Supabase auth host; the project ref is inlined at build time.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "studysphere-hub",
  title: "StudySphere Hub",
  version: "0.1.0",
  instructions:
    "Tools for StudySphere Hub, a students' notes sharing hub. Requires a signed-in StudySphere Hub account. Use `list_catalog` for the department/year/semester structure, `check_upload_rules` for allowed note file types and size limits, and `get_app_guide` to explain how app features work.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCatalogTool, uploadRulesTool, appGuideTool],
});
