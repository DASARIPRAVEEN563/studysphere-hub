import { defineMcp, type AnyToolDefinition } from "@lovable.dev/mcp-js";
import listCatalogTool from "./tools/list-catalog";
import uploadRulesTool from "./tools/upload-rules";
import appGuideTool from "./tools/app-guide";

export default defineMcp({
  name: "studysphere-hub",
  title: "StudySphere Hub",
  version: "0.1.0",
  instructions:
    "Public tools for StudySphere Hub, a students' notes sharing hub. Use `list_catalog` for the department/year/semester structure, `check_upload_rules` for allowed note file types and size limits, and `get_app_guide` to explain how app features work. No student data is exposed.",
  tools: [listCatalogTool, uploadRulesTool, appGuideTool] as AnyToolDefinition[],
});
