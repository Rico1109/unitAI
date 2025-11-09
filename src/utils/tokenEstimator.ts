/**
 * Token Estimator Utility
 *
 * Provides token cost estimation for files and tool operations
 * to enable intelligent, token-aware decision making.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { stat, access } from "fs/promises";
import { constants } from "fs";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

/**
 * Token estimate result
 */
export interface TokenEstimate {
  /** Lines of code in file */
  loc: number;
  /** Estimated tokens (LOC × average tokens per line) */
  estimatedTokens: number;
  /** File size classification */
  classification: "small" | "medium" | "large" | "xlarge";
  /** File path analyzed */
  filePath: string;
  /** File size in bytes */
  sizeBytes: number;
}

/**
 * Tool suggestion based on context
 */
export interface ToolSuggestion {
  /** Recommended tool to use */
  recommended: "serena" | "claude-context" | "workflow" | "read";
  /** Human-readable reason for suggestion */
  reason: string;
  /** Tool that should be blocked (if any) */
  blockedTool?: string;
  /** Specific tool commands to use */
  suggestedCommands?: string[];
  /** Estimated token savings if suggestion followed */
  estimatedSavings?: number;
}

/**
 * Context for tool selection decision
 */
export interface ToolContext {
  /** Tool being considered */
  tool: "Read" | "Bash" | "Grep" | "Glob";
  /** File path (for Read) or command (for Bash) */
  target: string;
  /** Additional context (e.g., grep pattern) */
  additionalContext?: Record<string, any>;
}

/**
 * Average tokens per line for different file types (empirical data)
 */
const TOKENS_PER_LINE: Record<string, number> = {
  ".ts": 0.4,
  ".tsx": 0.45,
  ".js": 0.35,
  ".jsx": 0.4,
  ".py": 0.38,
  ".java": 0.42,
  ".go": 0.36,
  ".rs": 0.40,
  ".cpp": 0.43,
  ".c": 0.38,
  ".h": 0.35,
  ".md": 0.25,
  ".json": 0.15,
  ".yaml": 0.20,
  ".yml": 0.20,
  default: 0.35
};

/**
 * File size classification thresholds (in LOC)
 */
const LOC_THRESHOLDS = {
  small: 300,      // <300 LOC
  medium: 600,     // 300-600 LOC
  large: 1000,     // 600-1000 LOC
  xlarge: Infinity // >1000 LOC
} as const;

/**
 * Estimate tokens for a file based on LOC and file type
 */
export async function estimateFileTokens(filePath: string): Promise<TokenEstimate> {
  try {
    // Check if file exists and is accessible
    await access(filePath, constants.R_OK);

    // Get file stats for size
    const stats = await stat(filePath);
    const sizeBytes = stats.size;

    // Count lines using wc -l (fast for large files)
    const { stdout } = await execAsync(`wc -l < "${filePath}"`);
    const loc = parseInt(stdout.trim(), 10) || 0;

    // Determine tokens per line based on file extension
    const ext = filePath.match(/\.\w+$/)?.[0] || "";
    const tokensPerLine = TOKENS_PER_LINE[ext] || TOKENS_PER_LINE.default;

    // Calculate estimated tokens
    const estimatedTokens = Math.ceil(loc * tokensPerLine);

    // Classify file size
    let classification: TokenEstimate["classification"];
    if (loc < LOC_THRESHOLDS.small) {
      classification = "small";
    } else if (loc < LOC_THRESHOLDS.medium) {
      classification = "medium";
    } else if (loc < LOC_THRESHOLDS.large) {
      classification = "large";
    } else {
      classification = "xlarge";
    }

    logger.debug(`Token estimate for ${filePath}: ${loc} LOC, ~${estimatedTokens} tokens (${classification})`);

    return {
      loc,
      estimatedTokens,
      classification,
      filePath,
      sizeBytes
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to estimate tokens for ${filePath}: ${errorMsg}`);

    // Return conservative estimate on error
    return {
      loc: 1000,
      estimatedTokens: 400,
      classification: "large",
      filePath,
      sizeBytes: 0
    };
  }
}

/**
 * Estimate output size for tool operations
 */
export function estimateToolOutput(tool: string, args: any): number {
  // Conservative estimates based on common tool usage
  switch (tool) {
    case "Grep":
      // Grep typically returns 10-100 matches, ~50 tokens each
      return 2500;
    case "Glob":
      // Glob returns file paths, minimal tokens
      return 500;
    case "Bash":
      // Bash commands vary widely, conservative estimate
      if (typeof args === "string" && args.includes("cat")) {
        return 5000; // cat can output full files
      }
      return 1000;
    default:
      return 1000;
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
 * Suggest optimal tool based on context
 *
 * Core decision logic:
 * - Code files → ALWAYS Serena (75-80% token savings)
 * - Pattern search → claude-context semantic search
 * - Multi-file operations → workflow orchestration
 * - Small non-code files → Read ok
 */
export async function suggestOptimalTool(context: ToolContext): Promise<ToolSuggestion> {
  const { tool, target, additionalContext } = context;

  // Case 1: Read tool on code files → ALWAYS suggest Serena
  if (tool === "Read" && isCodeFile(target)) {
    const estimate = await estimateFileTokens(target);

    // Calculate savings (75-80% with Serena)
    const serenaTokens = Math.ceil(estimate.estimatedTokens * 0.25); // Only 25% of full file
    const savings = estimate.estimatedTokens - serenaTokens;

    return {
      recommended: "serena",
      reason: `Code file (${estimate.loc} LOC, ~${estimate.estimatedTokens} tokens). Serena provides 75-80% token savings through symbol-level navigation.`,
      blockedTool: "Read",
      suggestedCommands: [
        `mcp__serena__get_symbols_overview("${target}") # Get file structure`,
        `mcp__serena__find_symbol("SymbolName", "${target}") # Find specific symbols`
      ],
      estimatedSavings: savings
    };
  }

  // Case 2: Grep on codebase → Suggest claude-context
  if (tool === "Grep" || (tool === "Bash" && target.match(/grep|rg/))) {
    return {
      recommended: "claude-context",
      reason: "Pattern search in codebase. claude-context provides semantic search with hybrid BM25+vector matching, finding related code beyond literal matches.",
      blockedTool: tool,
      suggestedCommands: [
        `mcp__claude-context__search_code("semantic query", "/home/dawid/Projects/unified-ai-mcp-tool")`
      ],
      estimatedSavings: 1500 // Semantic search is much more targeted
    };
  }

  // Case 3: Bash cat/find commands on code → Suggest Serena
  if (tool === "Bash" && target.match(/^(cat|find)/)) {
    const fileMatch = target.match(/(?:cat|find)\s+([^\s]+)/);
    if (fileMatch && isCodeFile(fileMatch[1])) {
      return {
        recommended: "serena",
        reason: "Bash command reading code file. Use Serena for symbol-level access instead.",
        blockedTool: "Bash",
        suggestedCommands: [
          `mcp__serena__get_symbols_overview("${fileMatch[1]}")`
        ]
      };
    }
  }

  // Case 4: Large file (even non-code) → Suggest Serena if applicable
  if (tool === "Read") {
    try {
      const estimate = await estimateFileTokens(target);

      if (estimate.classification === "xlarge" || estimate.classification === "large") {
        if (isCodeFile(target)) {
          return {
            recommended: "serena",
            reason: `Large file (${estimate.loc} LOC). Serena recommended for efficient navigation.`,
            blockedTool: "Read",
            estimatedSavings: Math.ceil(estimate.estimatedTokens * 0.75)
          };
        } else {
          // Non-code large file - suggest asking Gemini to analyze
          return {
            recommended: "workflow",
            reason: `Large non-code file (${estimate.loc} lines, ${estimate.estimatedTokens} tokens). Consider using ask-gemini for summarization.`,
            suggestedCommands: [
              `mcp__unified-ai-mcp__ask-gemini("@${target} Summarize key points")`
            ]
          };
        }
      }
    } catch (error) {
      // If estimation fails, be conservative
      logger.warn(`Could not estimate file size for ${target}, suggesting Serena as fallback`);
    }
  }

  // Case 5: Small non-code file or safe operation → Allow
  return {
    recommended: "read",
    reason: "Small file or non-code content. Read tool is appropriate.",
    suggestedCommands: []
  };
}

/**
 * Format tool suggestion as human-readable message
 */
export function formatToolSuggestion(suggestion: ToolSuggestion): string {
  let message = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

  if (suggestion.blockedTool) {
    message += `❌ BLOCKED: ${suggestion.blockedTool} tool not recommended\n`;
  }

  message += `✅ RECOMMENDED: ${suggestion.recommended.toUpperCase()}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `${suggestion.reason}\n\n`;

  if (suggestion.suggestedCommands && suggestion.suggestedCommands.length > 0) {
    message += "Suggested commands:\n";
    suggestion.suggestedCommands.forEach(cmd => {
      message += `  ${cmd}\n`;
    });
    message += "\n";
  }

  if (suggestion.estimatedSavings) {
    message += `💰 Estimated token savings: ~${suggestion.estimatedSavings} tokens\n`;
  }

  message += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

  return message;
}
