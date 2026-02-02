import { executeCommand } from "./commandExecutor.js";
import { logger } from "../logger.js";
/**
 * Execute a Git command and return the output
 */
async function runGitCommand(args) {
    try {
        return await executeCommand("git", args);
    }
    catch (error) {
        logger.error(`Error executing git command '${args.join(" ")}':`, error);
        throw error;
    }
}
/**
 * Check if the current directory is a Git repository
 */
export async function isGitRepository() {
    try {
        await runGitCommand(["rev-parse", "--git-dir"]);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get information about the current Git repository
 */
export async function getGitRepoInfo() {
    if (!await isGitRepository()) {
        throw new Error("Current directory is not a Git repository");
    }
    try {
        // Current branch
        const branchOutput = await runGitCommand(["branch", "--show-current"]);
        const currentBranch = branchOutput.trim();
        // Status
        const statusOutput = await runGitCommand(["status", "--porcelain"]);
        const status = statusOutput.trim();
        // Recent commits
        const logOutput = await runGitCommand(["log", "--oneline", "-5"]);
        const recentCommits = logOutput.trim().split("\n").filter(line => line.trim());
        // Staged files
        const stagedOutput = await runGitCommand(["diff", "--cached", "--name-only"]);
        const stagedFiles = stagedOutput.trim() ? stagedOutput.trim().split("\n") : [];
        // Modified files
        const modifiedOutput = await runGitCommand(["diff", "--name-only"]);
        const modifiedFiles = modifiedOutput.trim() ? modifiedOutput.trim().split("\n") : [];
        return {
            currentBranch,
            status,
            recentCommits,
            stagedFiles,
            modifiedFiles
        };
    }
    catch (error) {
        logger.error("Error retrieving Git repository information:", error);
        throw error;
    }
}
/**
 * Get the current branch name
 */
export async function getCurrentBranch() {
    if (!await isGitRepository()) {
        throw new Error("Current directory is not a Git repository");
    }
    const branchOutput = await runGitCommand(["branch", "--show-current"]);
    return branchOutput.trim();
}
/**
 * Get information about a specific commit
 */
export async function getGitCommitInfo(commitRef = "HEAD") {
    if (!await isGitRepository()) {
        throw new Error("Current directory is not a Git repository");
    }
    try {
        // Informazioni base del commit
        const showOutput = await runGitCommand(["show", "--format=%H|%an|%ad|%s", "--date=iso", commitRef]);
        const [hash, author, date, message] = showOutput.split("\n")[0].split("|");
        // Diff del commit
        const diffOutput = await runGitCommand(["show", "--format=", commitRef]);
        const diff = diffOutput;
        // Files modified in the commit
        const nameOnlyOutput = await runGitCommand(["show", "--format=", "--name-only", commitRef]);
        const files = nameOnlyOutput.trim() ? nameOnlyOutput.trim().split("\n") : [];
        return {
            hash,
            author,
            date,
            message,
            diff,
            files
        };
    }
    catch (error) {
        logger.error(`Error retrieving commit information for '${commitRef}':`, error);
        throw error;
    }
}
/**
 * Get the diff between two commits
 */
export async function getGitDiff(fromRef, toRef = "HEAD") {
    if (!await isGitRepository()) {
        throw new Error("Current directory is not a Git repository");
    }
    try {
        return await runGitCommand(["diff", `${fromRef}..${toRef}`]);
    }
    catch (error) {
        logger.error(`Error retrieving diff between '${fromRef}' and '${toRef}':`, error);
        throw error;
    }
}
/**
 * Get the diff of staged files
 */
export async function getStagedDiff() {
    if (!await isGitRepository()) {
        throw new Error("Current directory is not a Git repository");
    }
    try {
        return await runGitCommand(["diff", "--cached"]);
    }
    catch (error) {
        logger.error("Error retrieving diff of staged files:", error);
        throw error;
    }
}
/**
 * Get detailed repository status
 */
export async function getDetailedGitStatus() {
    if (!await isGitRepository()) {
        throw new Error("Current directory is not a Git repository");
    }
    try {
        return await runGitCommand(["status"]);
    }
    catch (error) {
        logger.error("Error retrieving repository status:", error);
        throw error;
    }
}
/**
 * Get local and remote branches
 */
export async function getGitBranches() {
    if (!await isGitRepository()) {
        throw new Error("Current directory is not a Git repository");
    }
    try {
        return await runGitCommand(["branch", "-vv"]);
    }
    catch (error) {
        logger.error("Error retrieving branches:", error);
        throw error;
    }
}
/**
 * Verifica se un file è tracciato da Git
 */
export async function isFileTracked(filePath) {
    if (!await isGitRepository()) {
        return false;
    }
    try {
        await runGitCommand(["ls-files", "--error-unmatch", filePath]);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get the last N commits with their complete diffs
 */
export async function getRecentCommitsWithDiffs(count = 10) {
    if (!await isGitRepository()) {
        throw new Error("Current directory is not a Git repository");
    }
    try {
        // Ottieni gli hash degli ultimi N commits
        const logOutput = await runGitCommand(["log", "--oneline", `-${count}`]);
        const hashes = logOutput
            .trim()
            .split("\n")
            .map(line => line.trim().split(" ")[0])
            .filter(hash => !!hash);
        // Per ogni hash, ottieni le informazioni complete
        const commits = [];
        for (const hash of hashes) {
            const commitInfo = await getGitCommitInfo(hash);
            commits.push(commitInfo);
        }
        return commits;
    }
    catch (error) {
        logger.error(`Error retrieving last ${count} commits:`, error);
        throw error;
    }
}
/**
 * Estrae il range di date da un array di commits
 */
export function getDateRangeFromCommits(commits) {
    if (commits.length === 0) {
        return null;
    }
    // I commit sono già ordinati dal più recente al più vecchio
    const newest = commits[0].date;
    const oldest = commits[commits.length - 1].date;
    return { oldest, newest };
}
/**
 * Verifica la disponibilità dei comandi CLI necessari
 */
export async function checkCLIAvailability() {
    // Map of display names to CLI command names
    // Keys match what init-session display code expects
    const backendToCommand = {
        "gemini": "gemini",
        "qwen": "qwen",
        "droid": "droid"
    };
    const availability = {};
    for (const [backend, cmd] of Object.entries(backendToCommand)) {
        try {
            await executeCommand(cmd, ["--version"]);
            availability[backend] = true;
        }
        catch {
            availability[backend] = false;
        }
    }
    return availability;
}
//# sourceMappingURL=gitHelper.js.map