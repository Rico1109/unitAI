#!/usr/bin/env node
/**
 * Workflow Pattern Detector Hook
 *
 * Analyzes user prompts and conversation context to detect patterns
 * that indicate a workflow should be triggered:
 * - Feature Implementation → feature-design workflow
 * - Bug Hunting → bug-hunt workflow
 * - Refactoring → Serena-based safe refactoring
 * - Code Review → parallel-review workflow
 *
 * Hook Type: UserPromptSubmit
 * Triggers: After user submits a prompt
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

// ES modules support for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLAUDE_PROJECT_DIR is set by Claude Code when running hooks
const projectDir = process.env.CLAUDE_PROJECT_DIR || join(__dirname, "..", "..");

/**
 * Pattern definitions for workflow detection
 */
const WORKFLOW_PATTERNS = {
  featureImplementation: {
    patterns: [
      /implement|add feature|create.*function|new.*class|build.*component/i,
      /add.*api.*endpoint|create.*route|new.*service/i,
      /implement.*oauth|add.*auth|create.*login/i
    ],
    workflow: "feature-design",
    confidence: 0,
    description: "Feature Implementation workflow - systematic approach to adding new functionality"
  },
  bugHunting: {
    patterns: [
      /bug|error|fix|broken|not working|debug|issue/i,
      /fails?|crash|exception|throws?/i,
      /why.*not.*work|doesn't work|won't work/i
    ],
    workflow: "bug-hunt",
    confidence: 0,
    description: "Bug Hunting workflow - AI-powered root cause analysis and fix recommendations"
  },
  refactoring: {
    patterns: [
      /refactor|rename|move|reorganize|clean.*up|restructure/i,
      /extract.*function|split.*class|consolidate/i,
      /improve.*structure|simplify|optimize.*code/i
    ],
    workflow: "refactoring-safe",
    confidence: 0,
    description: "Safe Refactoring workflow - Serena find_referencing_symbols + surgical edits"
  },
  codeReview: {
    patterns: [
      /review|analyze.*code|check.*quality|validate/i,
      /pre-?commit|before.*commit|ready.*to.*commit/i,
      /security.*review|check.*vulnerabilities/i
    ],
    workflow: "parallel-review",
    confidence: 0,
    description: "Parallel Review workflow - Multi-AI code quality analysis"
  },
  preCommitValidation: {
    patterns: [
      /commit|ready.*commit|before.*commit/i,
      /validate.*changes|check.*changes/i
    ],
    workflow: "pre-commit-validate",
    confidence: 0,
    description: "Pre-commit Validation workflow - Automated quality checks before commit"
  }
};

/**
 * Parse prompt from stdin
 */
function getPrompt(): string {
  try {
    const stdin = readFileSync(0, "utf-8");
    return stdin.trim();
  } catch {
    return "";
  }
}

/**
 * Detect workflow pattern from prompt
 */
function detectPattern(prompt: string): typeof WORKFLOW_PATTERNS[keyof typeof WORKFLOW_PATTERNS] | null {
  let bestMatch: typeof WORKFLOW_PATTERNS[keyof typeof WORKFLOW_PATTERNS] | null = null;
  let highestConfidence = 0;

  for (const [key, patternDef] of Object.entries(WORKFLOW_PATTERNS)) {
    let confidence = 0;
    let matches = 0;

    for (const pattern of patternDef.patterns) {
      if (pattern.test(prompt)) {
        matches++;
        confidence += 0.3; // Each pattern match adds confidence
      }
    }

    // Boost confidence if multiple patterns match
    if (matches > 1) {
      confidence *= 1.5;
    }

    if (confidence > highestConfidence && confidence > 0.5) {
      highestConfidence = confidence;
      bestMatch = { ...patternDef, confidence };
    }
  }

  return bestMatch;
}

/**
 * Count file mentions in prompt (e.g., @file.ts, file.ts, src/file.ts)
 */
function countFileMentions(prompt: string): number {
  const filePatterns = [
    /@[\w\/\-\.]+\.\w+/g, // @file.ts
    /[\w\/\-]+\.\w{2,4}/g // file.ts or path/to/file.ts
  ];

  let count = 0;
  for (const pattern of filePatterns) {
    const matches = prompt.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Generate workflow suggestion message
 */
function generateWorkflowSuggestion(
  pattern: ReturnType<typeof detectPattern>,
  fileCount: number
): string {
  if (!pattern) return "";

  const isMultiFile = fileCount >= 2;
  const urgency = pattern.confidence > 0.8 ? "STRONGLY" : pattern.confidence > 0.6 ? "HIGHLY" : "";

  let message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 WORKFLOW PATTERN DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pattern: ${pattern.workflow}
Confidence: ${Math.round(pattern.confidence * 100)}%
${isMultiFile ? `Files involved: ${fileCount}` : ""}

${pattern.description}

`;

  // Workflow-specific guidance
  switch (pattern.workflow) {
    case "feature-design":
      message += `📋 Recommended approach:
1. claude-context: "Where is similar functionality implemented?"
2. Serena: get_symbols_overview (target files)
3. Parallel AI: ask-gemini + ask-qwen for architecture review
4. ask-rovodev: Generate implementation with error handling
5. Serena: find_referencing_symbols (verify no breakage)

${urgency ? `${urgency} RECOMMENDED` : "Consider"} using workflow:
  mcp__unified-ai-mcp__smart-workflows("feature-design", params)
`;
      break;

    case "bug-hunt":
      message += `🐛 Recommended approach:
1. claude-context: "Find related code and similar bugs"
2. Serena: get_symbols_overview (affected files)
3. Parallel AI: ask-gemini + ask-qwen for root cause analysis
4. Serena: find_referencing_symbols (understand impact)
5. Apply fix with Serena surgical edits

${urgency ? `${urgency} RECOMMENDED` : "Consider"} using workflow:
  mcp__unified-ai-mcp__smart-workflows("bug-hunt", { symptom: "..." })
`;
      break;

    case "refactoring-safe":
      message += `🔧 Recommended approach:
1. claude-context: "Find all functions with pattern X"
2. Serena: get_symbols_overview → Map structure
3. Serena: find_referencing_symbols → Identify ALL usages (critical!)
4. Parallel AI: ask-gemini + ask-qwen for refactoring strategy
5. Serena: rename_symbol OR replace_symbol_body (safe edits)

⚠️  CRITICAL: ALWAYS use find_referencing_symbols before refactoring
`;
      break;

    case "parallel-review":
      message += `👀 Recommended approach:
1. Get staged changes: git diff --cached
2. Parallel AI analysis:
   - ask-gemini: Architecture + best practices
   - ask-qwen: Code quality + patterns
   - ask-rovodev: Security + production readiness

${urgency ? `${urgency} RECOMMENDED` : "Consider"} using workflow:
  mcp__unified-ai-mcp__smart-workflows("parallel-review")
`;
      break;

    case "pre-commit-validate":
      message += `✅ Recommended approach:
1. Parallel validation:
   - Qwen: Secret detection
   - Gemini: Code quality
   - Rovodev: Breaking changes
2. Generate verdict: Pass/Warn/Fail
3. Provide actionable feedback

${urgency ? `${urgency} RECOMMENDED` : "Consider"} using workflow:
  mcp__unified-ai-mcp__smart-workflows("pre-commit-validate", { depth: "thorough" })
`;
      break;
  }

  message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  return message;
}

/**
 * Main hook execution
 */
async function main() {
  const prompt = getPrompt();

  if (!prompt) {
    process.exit(0);
  }

  // Detect pattern
  const pattern = detectPattern(prompt);

  if (!pattern) {
    // No pattern detected, exit silently
    process.exit(0);
  }

  // Count file mentions to determine complexity
  const fileCount = countFileMentions(prompt);

  // Generate suggestion
  const suggestion = generateWorkflowSuggestion(pattern, fileCount);

  if (suggestion) {
    // Output to Claude
    console.log(suggestion);

    // Log for debugging
    const logPath = join(projectDir, ".claude", "tsc-cache", "workflow-pattern-detector.log");
    try {
      const { appendFileSync } = await import("fs");
      const timestamp = new Date().toISOString();
      appendFileSync(
        logPath,
        `[${timestamp}] Pattern: ${pattern.workflow}, Confidence: ${pattern.confidence}, Files: ${fileCount}\nPrompt: ${prompt.substring(0, 200)}...\n${suggestion}\n\n`
      );
    } catch {
      // Silent fail
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Workflow pattern detector error:", error);
  process.exit(0);
});
