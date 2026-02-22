import { z } from "zod";
import * as fs from "fs";
import os from "os";
import * as path from "path";
import { execSync } from "child_process";
import { getGitRepoInfo, getGitDiff, getDetailedGitStatus, getGitBranches, checkCLIAvailability, isGitRepository, getRecentCommitsWithDiffs, getDateRangeFromCommits } from "../utils/cli/gitHelper.js";
import { formatWorkflowOutput } from "./utils.js";
import { executeAIClient } from "../services/ai-executor.js";
import { BACKENDS, AI_MODELS } from "../constants.js";
import { selectParallelBackends, createTaskCharacteristics } from "./model-selector.js";
import { getDependencies } from '../dependencies.js';
import type { WorkflowDefinition, ProgressCallback, GitCommitInfo } from "../domain/workflows/types.js";

/**
 * Zod Schema for init-session workflow
 */
const initSessionSchema = z.object({
  autonomyLevel: z.enum(["auto", "read-only", "low", "medium", "high"])
    .default("auto")
    .describe('Ask the user: "What permission level for this workflow? auto = I choose the minimum needed, read-only = analysis only, low = file writes allowed, medium = git commit/branch/install deps, high = git push + external APIs." Use auto if unsure.'),
  commitCount: z.number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum number of recent commits to analyze (default: 10)"),
  fresh: z.boolean()
    .optional()
    .describe("Force a fresh run, bypassing the 30-minute session cache")
});

/**
 * Extracts significant keywords from commit messages
 */
function extractKeywordsFromCommits(commits: GitCommitInfo[]): string[] {
  const keywords = new Set<string>();
  const stopWords = ['add', 'fix', 'update', 'refactor', 'improve', 'remove', 'delete', 'change', 'modify', 'create', 'implement', 'the', 'and', 'or', 'for', 'with', 'from', 'to', 'in', 'on', 'at'];

  commits.forEach(commit => {
    // Extract words from commit message
    const words = commit.message
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));

    words.forEach(word => keywords.add(word));

    // Extract also from modified file names
    commit.files.forEach(file => {
      const baseName = path.basename(file, path.extname(file));
      const fileWords = baseName
        .split(/[-_.]/)
        .filter(word => word.length > 3 && !stopWords.includes(word.toLowerCase()));

      fileWords.forEach(word => keywords.add(word.toLowerCase()));
    });
  });

  return Array.from(keywords);
}

/**
 * Extracts title from markdown file (first non-empty line or first heading)
 */
function extractTitleFromContent(content: string): string {
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // If it is a markdown heading, remove the marker
    if (trimmed.startsWith('#')) {
      return trimmed.replace(/^#+\s*/, '').substring(0, 80);
    }

    // Otherwise use the first non-empty line
    return trimmed.substring(0, 80);
  }

  return 'No title found';
}

/**
 * Recursively finds all markdown files in a directory
 */
function findMarkdownFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;

  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        // Skip hidden folders and node_modules
        if (file.name !== 'node_modules' && !file.name.startsWith('.')) {
          findMarkdownFiles(filePath, fileList);
        }
      } else if (file.name.endsWith('.md')) {
        // Get relative path for cleaner display
        fileList.push(filePath);
      }
    }
  } catch (error) {
    // Ignore access errors
    console.error(`Error reading directory ${dir}:`, error);
  }
  return fileList;
}

/**
 * Searches for relevant documentation in .serena/memories and docs/
 * based on recent commits
 */
function searchRelatedDocumentation(commits: GitCommitInfo[]): string[] {
  const results: string[] = [];
  const projectRoot = process.cwd();

  // Directories to search
  const searchDirs = [
    path.join(projectRoot, '.serena', 'memories'),
    path.join(projectRoot, 'docs')
  ];

  // 1. Extract keywords from commits
  const keywords = extractKeywordsFromCommits(commits);
  if (keywords.length === 0) return results;

  // 2. Gather all markdown files
  const markdownFiles: string[] = [];
  searchDirs.forEach(dir => findMarkdownFiles(dir, markdownFiles));

  if (markdownFiles.length === 0) return results;

  // 3. Search for keywords in files
  for (const filePath of markdownFiles) {
    let content: string;

    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      continue;
    }

    // Searches for keyword matches in content
    const matches = keywords.filter(kw =>
      content.toLowerCase().includes(kw.toLowerCase())
    );

    if (matches.length > 0) {
      const title = extractTitleFromContent(content);
      // Get relative path for display
      const relPath = path.relative(projectRoot, filePath);

      results.push(`- **${relPath}**: ${title} (matches: ${matches.slice(0, 5).join(', ')}${matches.length > 5 ? ', ...' : ''})`);
    }
  }

  // Sort by number of matches (descending)
  return results.sort((a, b) => {
    const matchesA = (a.match(/matches:/)?.[0] || '').split(',').length;
    const matchesB = (b.match(/matches:/)?.[0] || '').split(',').length;
    return matchesB - matchesA;
  });
}

/**
 * Constructs the prompt for AI commit analysis
 */
function buildCommitAnalysisPrompt(commits: GitCommitInfo[]): string {
  let prompt = `Analyze the following ${commits.length} recent commits and provide a concise summary of the work done.

Focus on:
1. **Feature changes**: What new features or functionality was added
2. **Bug fixes**: What bugs were fixed and their root causes
3. **Refactoring/architecture**: Structural changes, code organization improvements
4. **Current work status**: What's in progress, what's completed, what might be next

Format your response as a clear, actionable summary that points to specific files and changes.

---

# Commits to Analyze

`;

  commits.forEach((commit, index) => {
    prompt += `
## Commit ${index + 1}: ${commit.message}
- **Author**: ${commit.author}
- **Date**: ${commit.date}
- **Hash**: ${commit.hash.substring(0, 8)}
- **Files**: ${commit.files.join(", ")}

### Diff (truncated to first 3000 chars):
\`\`\`diff
${commit.diff.substring(0, 3000)}${commit.diff.length > 3000 ? "\n... (diff truncated)" : ""}
\`\`\`

---
`;
  });

  prompt += `
Please provide a synthesized analysis of these commits.`;

  return prompt;
}

/**
 * Cache schema for init-session output
 */
interface SessionCache {
  key: string;      // "branch:sha"
  ts: string;       // ISO8601 when cached
  ttlMs: number;    // 1800000 (30 minutes)
  output: string;   // full formatted output
}

/**
 * Executes the session initialization workflow
 */
export async function executeInitSession(
  params: z.infer<typeof initSessionSchema>,
  onProgress?: ProgressCallback
): Promise<string> {
  const { autonomyLevel, commitCount, fresh } = initSessionSchema.parse(params);

  // --- 30-minute session cache ---
  const cachePath = path.join(os.homedir(), ".unitai", "session-cache.json");
  let cacheKey: string | undefined;

  // Always attempt to compute the cache key (git HEAD + branch)
  try {
    const sha = execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    const branch = execSync("git branch --show-current", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    cacheKey = `${branch}:${sha}`;
  } catch {
    // git command failed - silently skip cache entirely
  }

  // Check cache only when not forcing a fresh run
  if (!fresh && cacheKey !== undefined) {
    try {
      const rawCache = fs.readFileSync(cachePath, "utf8");
      const cache: SessionCache = JSON.parse(rawCache);
      if (
        cache.key === cacheKey &&
        Date.now() - Date.parse(cache.ts) < cache.ttlMs
      ) {
        const ageMin = Math.floor((Date.now() - Date.parse(cache.ts)) / 60000);
        return `> Cached session (${ageMin} min ago) - HEAD unchanged. Re-run \`init-session\` with \`--fresh\` to force refresh.\n\n${cache.output}`;
      }
    } catch {
      // cache missing or corrupt - silently skip, proceed with full run
    }
  }
  // --- end cache read ---

  onProgress?.("Starting session initialization... (Starting session initialization...)");


  const sections: string[] = [];
  const metadata: Record<string, any> = {};

  // Check if we are in a Git repository
  const isRepo = await isGitRepository();
  metadata.isGitRepository = isRepo;

  if (isRepo) {
    onProgress?.("Retrieving Git repository information...");

    try {
      // Basic repository information
      const repoInfo = await getGitRepoInfo();
      sections.push(`
## Repository Information

- **Current branch**: ${repoInfo.currentBranch}
- **Staged files**: ${repoInfo.stagedFiles.length}
- **Modified files**: ${repoInfo.modifiedFiles.length}
`);

      // Get last 10 commits with full diffs
      const commitsToAnalyze = commitCount ?? 10;
      onProgress?.(`Retrieving last ${commitsToAnalyze} commits with diffs...`);
      const recentCommits = await getRecentCommitsWithDiffs(commitsToAnalyze);
      metadata.commitsAnalyzed = recentCommits.length;

      // Recent commits (summary)
      sections.push(`
## Recent Commits (last 10)

${recentCommits.map((commit, i) => `${i + 1}. [${commit.hash.substring(0, 8)}] ${commit.message} - ${commit.author}`).join("\n")}
`);

      // AI analysis with fallback between multiple backends
      const analysisPrompt = buildCommitAnalysisPrompt(recentCommits);
      
      const { circuitBreaker } = getDependencies();
      const task = createTaskCharacteristics('init-session', { requiresArchitecturalThinking: true, complexity: 'medium' });
      const analysisBackends = await selectParallelBackends(task, circuitBreaker, 2);
      
      let aiAnalysis = "";
      let lastAnalysisError: string | undefined;

      for (const backend of analysisBackends) {
        onProgress?.(`AI commit analysis with ${backend}...`);
        try {
          aiAnalysis = await executeAIClient({
            backend,
            model: AI_MODELS.GEMINI.FLASH,
            prompt: analysisPrompt
          });
          metadata.aiAnalysisCompleted = true;
          metadata.aiAnalysisBackend = backend;
          break;
        } catch (error) {
          lastAnalysisError = error instanceof Error ? error.message : String(error);
          onProgress?.(`Analysis with ${backend} failed: ${lastAnalysisError}`);
        }
      }

      if (aiAnalysis) {
        sections.push(`
## AI Analysis of Recent Work

${aiAnalysis}
`);
      } else {
        sections.push(`
## AI Analysis

⚠️ Could not complete AI analysis${lastAnalysisError ? `: ${lastAnalysisError}` : ""}
`);
        metadata.aiAnalysisCompleted = false;
      }

      // Search relevant documentation and memories based on commits
      onProgress?.("Searching related documentation...");
      const relatedDocs = searchRelatedDocumentation(recentCommits);

      if (relatedDocs.length > 0) {
        metadata.relatedDocsFound = relatedDocs.length;

        sections.push(`
## Relevant Documentation & Memories

Based on commit analysis, these documents may be relevant:

${relatedDocs.join('\n')}

*Use \`check_file\` or \`read_file\` to review specific documents.*
`);
      } else {
        const dateRange = getDateRangeFromCommits(recentCommits);
        sections.push(`
## Relevant Documentation & Memories

No matching documents found in \`.serena/memories/\` or \`docs/\` based on recent commits.

${dateRange ? `📅 Commit date range: ${dateRange.oldest} to ${dateRange.newest}` : ''}
`);
      }

      // Detailed status
      onProgress?.("Retrieving repository status...");
      const status = await getDetailedGitStatus();
      sections.push(`
## Repository Status

\`\`\`
${status}
\`\`\`
`);

      // Branch information
      onProgress?.("Retrieving branch information...");
      const branches = await getGitBranches();
      sections.push(`
## Branches

\`\`\`
${branches}
\`\`\`
`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      sections.push(`
## Error retrieving Git information

${errorMsg}
`);
    }
  } else {
    sections.push(`
## Git Repository

Current directory is not a Git repository.
`);
  }

  // Check CLI availability
  onProgress?.("Check CLI availability...");
  try {
    const cliAvailability = await checkCLIAvailability();
    metadata.cliAvailability = cliAvailability;

    sections.push(`
## CLI Availability

- **Gemini**: ${cliAvailability.gemini ? "✅ Available" : "❌ Not available"}
- **Qwen**: ${cliAvailability.qwen ? "✅ Available" : "❌ Not available"}
- **Droid**: ${cliAvailability.droid ? "✅ Available" : "❌ Not available"}
`);

    // Warnings if any CLI is unavailable
    const unavailable = Object.entries(cliAvailability)
      .filter(([_, available]) => !available)
      .map(([name]) => name);

    if (unavailable.length > 0) {
      sections.push(`
### ⚠️ Warning

The following CLIs are unavailable: ${unavailable.join(", ")}
Some workflows may not work correctly.
`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    sections.push(`
## Error in CLI verification

${errorMsg}
`);
  }

  // Session information
  const now = new Date();
  metadata.sessionStartTime = now.toISOString();
  metadata.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  sections.push(`
## Session Information

- **Date and time**: ${now.toLocaleString()}
- **Timezone**: ${metadata.timezone}
- **Working directory**: ${process.cwd()}
`);

  onProgress?.("Session initialized successfully");


  onProgress?.("Session initialized successfully");

  const result = formatWorkflowOutput("Session Initialization Report (Session Initialization Report)", sections.join("\n"), metadata);

  // --- write session cache ---
  if (cacheKey !== undefined) {
    try {
      const cacheDir = path.dirname(cachePath);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      const cacheData: SessionCache = {
        key: cacheKey,
        ts: new Date().toISOString(),
        ttlMs: 1800000,
        output: result,
      };
      fs.writeFileSync(cachePath, JSON.stringify(cacheData), "utf8");
    } catch {
      // cache write failure is non-fatal
    }
  }
  // --- end cache write ---

  return result;
}

/**
 * Definition of init-session workflow
 */
export const initSessionWorkflow: WorkflowDefinition = {
  name: 'init-session',
  description: "Initializes the current session by analyzing the Git repository and checking CLI availability",
  schema: initSessionSchema,
  execute: executeInitSession
};
