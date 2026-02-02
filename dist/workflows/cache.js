/**
 * Workflow Cache System
 *
 * Provides caching for workflow results to avoid redundant AI calls.
 * Uses content-based hashing for cache keys and TTL-based expiration.
 * Implements Reader-Writer Lock pattern to prevent race conditions.
 */
import { createHash } from 'crypto';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
/**
 * Reader-Writer Lock Implementation
 *
 * Allows multiple concurrent readers but exclusive access for writers.
 * Prevents read-during-write race conditions that could cause stale/partial data.
 */
class RWLock {
    readLocks = 0;
    writeLock = false;
    waitingReaders = [];
    waitingWriters = [];
    /**
     * Acquire a read lock
     * Multiple readers can hold read locks simultaneously
     * Waits if a writer is active
     */
    async acquireRead() {
        if (!this.writeLock) {
            // No writer active, acquire immediately
            this.readLocks++;
            return;
        }
        // Writer is active, wait for it to finish
        return new Promise((resolve) => {
            this.waitingReaders.push(resolve);
        });
    }
    /**
     * Release a read lock
     * If this was the last reader, wake up the next waiting writer
     */
    releaseRead() {
        this.readLocks--;
        if (this.readLocks === 0 && this.waitingWriters.length > 0) {
            // No more readers, wake up the next writer
            const nextWriter = this.waitingWriters.shift();
            if (nextWriter) {
                this.writeLock = true;
                nextWriter();
            }
        }
    }
    /**
     * Acquire a write lock
     * Exclusive access - waits for all readers and other writers
     */
    async acquireWrite() {
        if (!this.writeLock && this.readLocks === 0) {
            // No locks active, acquire immediately
            this.writeLock = true;
            return;
        }
        // Some locks are active, wait for them to finish
        return new Promise((resolve) => {
            this.waitingWriters.push(resolve);
        });
    }
    /**
     * Release a write lock
     * Wakes up all waiting readers (multiple readers can proceed)
     * or the next writer if no readers are waiting
     */
    releaseWrite() {
        this.writeLock = false;
        if (this.waitingReaders.length > 0) {
            // Wake up all waiting readers
            this.readLocks = this.waitingReaders.length;
            const waitingReadersCopy = [...this.waitingReaders];
            this.waitingReaders = [];
            waitingReadersCopy.forEach((resolve) => resolve());
        }
        else if (this.waitingWriters.length > 0) {
            // Wake up the next writer
            const nextWriter = this.waitingWriters.shift();
            if (nextWriter) {
                this.writeLock = true;
                nextWriter();
            }
        }
    }
}
/**
 * Workflow cache implementation
 */
export class WorkflowCache {
    cache = new Map();
    stats = { hits: 0, misses: 0 };
    cacheDir;
    rwLock = new RWLock();
    constructor(cacheDir = join(process.cwd(), '.cache', 'workflows')) {
        this.cacheDir = cacheDir;
        if (!existsSync(this.cacheDir)) {
            mkdirSync(this.cacheDir, { recursive: true });
        }
        this.loadFromDisk();
    }
    /**
     * Compute cache key from workflow name, params, and file contents
     */
    computeCacheKey(workflowName, params, fileContents) {
        // Create a deterministic representation
        const normalizedData = {
            workflow: workflowName,
            params: this.sortObject(params),
            contents: fileContents ? this.sortObject(fileContents) : undefined
        };
        const json = JSON.stringify(normalizedData);
        return createHash('sha256').update(json).digest('hex');
    }
    /**
     * Recursively sort object keys for deterministic serialization
     */
    sortObject(obj) {
        if (obj === null || obj === undefined)
            return obj;
        if (typeof obj !== 'object')
            return obj;
        if (Array.isArray(obj))
            return obj.map(item => this.sortObject(item));
        const sorted = {};
        Object.keys(obj).sort().forEach(key => {
            sorted[key] = this.sortObject(obj[key]);
        });
        return sorted;
    }
    /**
     * Get cached result if valid
     */
    async get(key) {
        await this.rwLock.acquireRead();
        try {
            const entry = this.cache.get(key);
            if (!entry) {
                this.stats.misses++;
                return null;
            }
            const age = Date.now() - entry.timestamp;
            if (age > entry.ttlSeconds * 1000) {
                this.cache.delete(key);
                this.stats.misses++;
                return null;
            }
            this.stats.hits++;
            return entry.result;
        }
        finally {
            this.rwLock.releaseRead();
        }
    }
    /**
     * Set cache entry
     */
    async set(key, result, workflowName, ttlSeconds, metadata) {
        await this.rwLock.acquireWrite();
        try {
            const entry = {
                key,
                result,
                timestamp: Date.now(),
                ttlSeconds,
                workflowName,
                metadata
            };
            this.cache.set(key, entry);
            await this.saveToDisk();
        }
        finally {
            this.rwLock.releaseWrite();
        }
    }
    /**
     * Clear expired entries
     */
    async cleanup() {
        await this.rwLock.acquireWrite();
        try {
            const now = Date.now();
            let removed = 0;
            for (const [key, entry] of this.cache.entries()) {
                const age = now - entry.timestamp;
                if (age > entry.ttlSeconds * 1000) {
                    this.cache.delete(key);
                    removed++;
                }
            }
            if (removed > 0) {
                await this.saveToDisk();
            }
            return removed;
        }
        finally {
            this.rwLock.releaseWrite();
        }
    }
    /**
     * Clear all cache entries
     */
    async clear() {
        await this.rwLock.acquireWrite();
        try {
            this.cache.clear();
            this.stats = { hits: 0, misses: 0 };
            await this.saveToDisk();
        }
        finally {
            this.rwLock.releaseWrite();
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            entries: this.cache.size,
            hitRate: total > 0 ? this.stats.hits / total : 0
        };
    }
    /**
     * Load cache from disk
     */
    loadFromDisk() {
        const cacheFile = join(this.cacheDir, 'cache.json');
        if (existsSync(cacheFile)) {
            try {
                const data = JSON.parse(readFileSync(cacheFile, 'utf-8'));
                if (data.entries) {
                    for (const entry of data.entries) {
                        this.cache.set(entry.key, entry);
                    }
                }
                if (data.stats) {
                    this.stats = data.stats;
                }
            }
            catch (error) {
                console.warn('Failed to load cache from disk:', error);
            }
        }
    }
    /**
     * Save cache to disk (protected by RWLock, caller must hold write lock)
     */
    async saveToDisk() {
        const cacheFile = join(this.cacheDir, 'cache.json');
        try {
            const data = {
                entries: Array.from(this.cache.values()),
                stats: this.stats,
                savedAt: new Date().toISOString()
            };
            await writeFile(cacheFile, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Failed to save cache to disk:', error);
            throw error; // Re-throw to make failures visible
        }
    }
}
/**
 * Default TTL configurations for different workflows (in seconds)
 */
export const DEFAULT_TTL = {
    'parallel-review': 3600, // 1 hour
    'pre-commit-validate': 1800, // 30 minutes
    'validate-last-commit': 3600, // 1 hour
    'bug-hunt': 1800, // 30 minutes
    'feature-design': 7200, // 2 hours
    'init-session': 300 // 5 minutes
};
/**
 * Singleton cache instance
 */
export const workflowCache = new WorkflowCache();
/**
 * Cleanup expired cache entries periodically
 * Runs every hour
 */
setInterval(async () => {
    const removed = await workflowCache.cleanup();
    if (removed > 0) {
        console.log(`Cache cleanup: removed ${removed} expired entries`);
    }
}, 60 * 60 * 1000);
//# sourceMappingURL=cache.js.map