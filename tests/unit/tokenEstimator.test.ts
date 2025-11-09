/**
 * Unit tests for tokenEstimator utility
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  estimateFileTokens,
  estimateToolOutput,
  suggestOptimalTool,
  formatToolSuggestion,
  type TokenEstimate,
  type ToolSuggestion,
  type ToolContext
} from "../../src/utils/tokenEstimator.js";
import { stat, access } from "fs/promises";

// Mock fs/promises
vi.mock("fs/promises");

// Mock child_process with promisified version
vi.mock("child_process", () => ({
  exec: vi.fn()
}));

// Mock util.promisify to return the async version directly
vi.mock("util", () => ({
  promisify: (fn: any) => fn
}));

describe("TokenEstimator", () => {
  describe("estimateFileTokens", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should estimate tokens for small TypeScript file", async () => {
      // Mock file access and stats
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 5000 } as any);

      // Mock wc -l output (200 lines) - promisified version
      const { exec } = await import("child_process");
      vi.mocked(exec).mockResolvedValue({ stdout: "200\n", stderr: "" } as any);

      const result = await estimateFileTokens("/path/to/file.ts");

      expect(result.loc).toBe(200);
      expect(result.classification).toBe("small");
      expect(result.estimatedTokens).toBe(80); // 200 * 0.4
      expect(result.filePath).toBe("/path/to/file.ts");
      expect(result.sizeBytes).toBe(5000);
    });

    it("should classify medium file correctly", async () => {
      const { exec } = await import("child_process");
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 15000 } as any);
      vi.mocked(exec).mockResolvedValue({ stdout: "450\n", stderr: "" } as any);

      const result = await estimateFileTokens("/path/to/file.ts");

      expect(result.loc).toBe(450);
      expect(result.classification).toBe("medium");
      expect(result.estimatedTokens).toBe(180); // 450 * 0.4
    });

    it("should classify large file correctly", async () => {
      const { exec } = await import("child_process");
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 35000 } as any);
      vi.mocked(exec).mockResolvedValue({ stdout: "800\n", stderr: "" } as any);

      const result = await estimateFileTokens("/path/to/large.ts");

      expect(result.loc).toBe(800);
      expect(result.classification).toBe("large");
      expect(result.estimatedTokens).toBe(320); // 800 * 0.4
    });

    it("should classify xlarge file correctly", async () => {
      const { exec } = await import("child_process");
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 80000 } as any);
      vi.mocked(exec).mockResolvedValue({ stdout: "1500\n", stderr: "" } as any);

      const result = await estimateFileTokens("/path/to/huge.ts");

      expect(result.loc).toBe(1500);
      expect(result.classification).toBe("xlarge");
      expect(result.estimatedTokens).toBe(600); // 1500 * 0.4
    });

    it("should use correct tokens per line for different file types", async () => {
      const { exec } = await import("child_process");
      // Reset mocks for this test
      vi.clearAllMocks();
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 3000 } as any);
      vi.mocked(exec).mockResolvedValue({ stdout: "100\n", stderr: "" } as any);

      // Python file (0.38 tokens per line)
      const resultPy = await estimateFileTokens("/path/to/file.py");
      expect(resultPy.estimatedTokens).toBe(38); // 100 * 0.38

      // Markdown file (0.25 tokens per line)
      const resultMd = await estimateFileTokens("/path/to/file.md");
      expect(resultMd.estimatedTokens).toBe(25); // 100 * 0.25

      // JSON file (0.15 tokens per line)
      const resultJson = await estimateFileTokens("/path/to/file.json");
      expect(resultJson.estimatedTokens).toBe(15); // 100 * 0.15
    });

    it("should return conservative estimate on error", async () => {
      vi.mocked(access).mockRejectedValue(new Error("File not found"));

      const result = await estimateFileTokens("/nonexistent/file.ts");

      expect(result.loc).toBe(1000);
      expect(result.estimatedTokens).toBe(400);
      expect(result.classification).toBe("large");
      expect(result.sizeBytes).toBe(0);
    });
  });

  describe("estimateToolOutput", () => {
    it("should estimate Grep output", () => {
      const estimate = estimateToolOutput("Grep", { pattern: "test" });
      expect(estimate).toBe(2500);
    });

    it("should estimate Glob output", () => {
      const estimate = estimateToolOutput("Glob", { pattern: "**/*.ts" });
      expect(estimate).toBe(500);
    });

    it("should estimate Bash cat output", () => {
      const estimate = estimateToolOutput("Bash", "cat large_file.ts");
      expect(estimate).toBe(5000);
    });

    it("should estimate generic Bash output", () => {
      const estimate = estimateToolOutput("Bash", "ls -la");
      expect(estimate).toBe(1000);
    });
  });

  describe("suggestOptimalTool", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should suggest Serena for TypeScript files", async () => {
      const { exec } = await import("child_process");
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 15000 } as any);
      vi.mocked(exec).mockResolvedValue({ stdout: "500\n", stderr: "" } as any);

      const context: ToolContext = {
        tool: "Read",
        target: "/path/to/component.ts"
      };

      const suggestion = await suggestOptimalTool(context);

      expect(suggestion.recommended).toBe("serena");
      expect(suggestion.blockedTool).toBe("Read");
      expect(suggestion.suggestedCommands).toHaveLength(2);
      expect(suggestion.suggestedCommands?.[0]).toContain("get_symbols_overview");
      expect(suggestion.estimatedSavings).toBeGreaterThan(0);
    });

    it("should suggest claude-context for Grep operations", async () => {
      const context: ToolContext = {
        tool: "Grep",
        target: "src/"
      };

      const suggestion = await suggestOptimalTool(context);

      expect(suggestion.recommended).toBe("claude-context");
      expect(suggestion.blockedTool).toBe("Grep");
      expect(suggestion.suggestedCommands?.[0]).toContain("search_code");
    });

    it("should suggest Serena for Bash cat commands on code", async () => {
      const context: ToolContext = {
        tool: "Bash",
        target: "cat src/utils/helper.ts"
      };

      const suggestion = await suggestOptimalTool(context);

      expect(suggestion.recommended).toBe("serena");
      expect(suggestion.blockedTool).toBe("Bash");
      expect(suggestion.suggestedCommands?.[0]).toContain("get_symbols_overview");
    });

    it("should allow Read for small non-code files", async () => {
      const { exec } = await import("child_process");
      // Reset mocks for clean state
      vi.clearAllMocks();
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 500 } as any);
      vi.mocked(exec).mockResolvedValue({ stdout: "50\n", stderr: "" } as any);

      const context: ToolContext = {
        tool: "Read",
        target: "/path/to/small.txt"
      };

      const suggestion = await suggestOptimalTool(context);

      expect(suggestion.recommended).toBe("read");
      expect(suggestion.blockedTool).toBeUndefined();
    });

    it("should suggest workflow for large non-code files", async () => {
      const { exec } = await import("child_process");
      vi.clearAllMocks();
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 100000 } as any);
      vi.mocked(exec).mockResolvedValue({ stdout: "2000\n", stderr: "" } as any);

      const context: ToolContext = {
        tool: "Read",
        target: "/path/to/huge_log.txt"
      };

      const suggestion = await suggestOptimalTool(context);

      expect(suggestion.recommended).toBe("workflow");
      expect(suggestion.suggestedCommands?.[0]).toContain("ask-gemini");
    });

    it("should calculate token savings correctly", async () => {
      const { exec } = await import("child_process");
      vi.mocked(access).mockResolvedValue(undefined);
      vi.mocked(stat).mockResolvedValue({ size: 20000 } as any);
      vi.mocked(exec).mockResolvedValue({ stdout: "1000\n", stderr: "" } as any);

      const context: ToolContext = {
        tool: "Read",
        target: "/path/to/large.ts"
      };

      const suggestion = await suggestOptimalTool(context);

      // 1000 LOC * 0.4 tokens/line = 400 tokens
      // Serena saves 75-80%, so savings ≈ 300 tokens
      expect(suggestion.estimatedSavings).toBeGreaterThan(250);
      expect(suggestion.estimatedSavings).toBeLessThan(350);
    });
  });

  describe("formatToolSuggestion", () => {
    it("should format blocked tool message correctly", () => {
      const suggestion: ToolSuggestion = {
        recommended: "serena",
        reason: "Code file detected",
        blockedTool: "Read",
        suggestedCommands: ["mcp__serena__get_symbols_overview(\"file.ts\")"],
        estimatedSavings: 300
      };

      const formatted = formatToolSuggestion(suggestion);

      expect(formatted).toContain("❌ BLOCKED: Read");
      expect(formatted).toContain("✅ RECOMMENDED: SERENA");
      expect(formatted).toContain("Code file detected");
      expect(formatted).toContain("mcp__serena__get_symbols_overview");
      expect(formatted).toContain("💰 Estimated token savings: ~300 tokens");
    });

    it("should format suggestion without blocked tool", () => {
      const suggestion: ToolSuggestion = {
        recommended: "read",
        reason: "Small file",
        suggestedCommands: []
      };

      const formatted = formatToolSuggestion(suggestion);

      expect(formatted).not.toContain("BLOCKED");
      expect(formatted).toContain("✅ RECOMMENDED: READ");
      expect(formatted).toContain("Small file");
    });

    it("should include all suggested commands", () => {
      const suggestion: ToolSuggestion = {
        recommended: "serena",
        reason: "Test",
        suggestedCommands: [
          "command1",
          "command2",
          "command3"
        ]
      };

      const formatted = formatToolSuggestion(suggestion);

      expect(formatted).toContain("command1");
      expect(formatted).toContain("command2");
      expect(formatted).toContain("command3");
    });
  });
});
