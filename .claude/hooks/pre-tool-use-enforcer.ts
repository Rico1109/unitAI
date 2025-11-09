#!/usr/bin/env node
/**
 * PRE-Tool-Use Enforcer Hook
 *
 * This hook intercepts BEFORE Claude uses Read/Bash/Grep tools
 * and suggests more efficient alternatives (Serena, claude-context)
 * based on file size and content type.
 *
 * Enforces token-aware decision making:
 * - Code files → ALWAYS use Serena (75-80% token savings)
 * - Pattern search → Use claude-context semantic search
 * - Bash cat/grep → Block and suggest Serena
 *
 * Hook Type: PreToolUse (experimental - suggestion only for now)
 * Triggers: Before Read, Bash, Grep tool execution
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

// ES modules support for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLAUDE_PROJECT_DIR is set by Claude Code when running hooks
// Fallback: go up two directories from .claude/hooks/ to project root
const projectDir = process.env.CLAUDE_PROJECT_DIR || join(__dirname, "..", "..");

interface ToolUseEvent {
  tool: string;
  params: Record<string, any>;
}

/**
 * Parse tool use event from stdin
 */
function parseToolUseEvent(): ToolUseEvent | null {
  try {
    const stdin = readFileSync(0, "utf-8");
    if (!stdin.trim()) {
      return null;
    }

    const event = JSON.parse(stdin);
    return {
      tool: event.tool || "",
      params: event.params || {}
    };
  } catch (error) {
    // Silent fail - hook should not break Claude
    return null;
  }
}

/**
 * Check if file is a code file based on extension
 */
function isCodeFile(filePath: string): boolean {
  const codeExtensions = [
    ".ts", ".tsx", ".js", ".jsx",
    ".py", ".java", ".go", ".rs",
    ".cpp", ".c", ".h", ".hpp",
    ".cs", ".rb", ".php", ".swift",
    ".kt", ".scala", ".clj"
  ];

  return codeExtensions.some(ext => filePath.endsWith(ext));
}

/**
 * Generate suggestion message for tool usage
 */
function generateSuggestion(tool: string, params: Record<string, any>): string | null {
  // Case 1: Read tool on code files
  if (tool === "Read" && params.file_path && isCodeFile(params.file_path)) {
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  TOKEN-AWARE SUGGESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You're about to use Read on a code file: ${params.file_path}

❌ NOT RECOMMENDED: Read tool for code files
✅ BETTER ALTERNATIVE: Serena (75-80% token savings)

Serena provides symbol-level navigation:
  mcp__serena__get_symbols_overview("${params.file_path}")
  mcp__serena__find_symbol("SymbolName", "${params.file_path}")

Why Serena?
- Only reads symbols you need, not entire file
- Structured output (classes, functions, types)
- Can find references across codebase
- 75-80% token savings on average

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  // Case 2: Grep on codebase
  if (tool === "Grep" && params.pattern) {
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  TOKEN-AWARE SUGGESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You're about to use Grep for pattern: "${params.pattern}"

❌ NOT RECOMMENDED: Grep for semantic code search
✅ BETTER ALTERNATIVE: claude-context

claude-context provides semantic search:
  mcp__claude-context__search_code(
    "${params.pattern}",
    "${projectDir}"
  )

Why claude-context?
- Hybrid BM25 + vector search
- Finds semantically related code, not just literal matches
- Better results for "find functions that do X"
- Indexed for fast search

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  // Case 3: Bash cat/grep/find commands on code
  if (tool === "Bash" && params.command) {
    const cmd = params.command;

    if (cmd.match(/^cat\s+.*\.(ts|js|py|java|go|rs|cpp|c|h)/)) {
      const fileMatch = cmd.match(/cat\s+([^\s]+)/);
      const file = fileMatch ? fileMatch[1] : "file";

      return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  TOKEN-AWARE SUGGESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You're about to use: ${cmd}

❌ NOT RECOMMENDED: Bash cat for code files
✅ BETTER ALTERNATIVE: Serena

Use Serena for symbol-level access:
  mcp__serena__get_symbols_overview("${file}")

Avoid reading entire files via Bash when
symbol-level navigation is available.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    if (cmd.match(/grep|rg/)) {
      return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  TOKEN-AWARE SUGGESTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You're about to use: ${cmd}

❌ NOT RECOMMENDED: Bash grep for code search
✅ BETTER ALTERNATIVE: claude-context or Serena

For semantic search:
  mcp__claude-context__search_code("query", "${projectDir}")

For symbol search:
  mcp__serena__search_for_pattern("pattern")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }
  }

  return null;
}

/**
 * Main hook execution
 */
async function main() {
  const event = parseToolUseEvent();

  if (!event) {
    // No event to process
    process.exit(0);
  }

  const suggestion = generateSuggestion(event.tool, event.params);

  if (suggestion) {
    // Output suggestion to Claude (stdout)
    console.log(suggestion);

    // Also log to file for debugging
    const logPath = join(projectDir, ".claude", "tsc-cache", "pre-tool-enforcer.log");
    try {
      const { appendFileSync } = await import("fs");
      const timestamp = new Date().toISOString();
      appendFileSync(
        logPath,
        `[${timestamp}] Tool: ${event.tool}, Params: ${JSON.stringify(event.params)}\n${suggestion}\n\n`
      );
    } catch {
      // Silent fail on log write
    }
  }

  // Exit with 0 - suggestions only, don't block
  process.exit(0);
}

main().catch((error) => {
  console.error("Pre-tool enforcer hook error:", error);
  process.exit(0); // Don't break Claude on hook error
});
