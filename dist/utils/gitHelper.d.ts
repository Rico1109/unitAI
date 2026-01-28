import type { GitRepoInfo, GitCommitInfo } from "../workflows/types.js";
/**
 * Check if the current directory is a Git repository
 */
export declare function isGitRepository(): Promise<boolean>;
/**
 * Get information about the current Git repository
 */
export declare function getGitRepoInfo(): Promise<GitRepoInfo>;
/**
 * Get the current branch name
 */
export declare function getCurrentBranch(): Promise<string>;
/**
 * Get information about a specific commit
 */
export declare function getGitCommitInfo(commitRef?: string): Promise<GitCommitInfo>;
/**
 * Get the diff between two commits
 */
export declare function getGitDiff(fromRef: string, toRef?: string): Promise<string>;
/**
 * Get the diff of staged files
 */
export declare function getStagedDiff(): Promise<string>;
/**
 * Get detailed repository status
 */
export declare function getDetailedGitStatus(): Promise<string>;
/**
 * Get local and remote branches
 */
export declare function getGitBranches(): Promise<string>;
/**
 * Verifica se un file è tracciato da Git
 */
export declare function isFileTracked(filePath: string): Promise<boolean>;
/**
 * Get the last N commits with their complete diffs
 */
export declare function getRecentCommitsWithDiffs(count?: number): Promise<GitCommitInfo[]>;
/**
 * Estrae il range di date da un array di commits
 */
export declare function getDateRangeFromCommits(commits: GitCommitInfo[]): {
    oldest: string;
    newest: string;
} | null;
/**
 * Verifica la disponibilità dei comandi CLI necessari
 */
export declare function checkCLIAvailability(): Promise<Record<string, boolean>>;
//# sourceMappingURL=gitHelper.d.ts.map