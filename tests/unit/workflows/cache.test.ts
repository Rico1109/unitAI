/**
 * Tests for workflow cache system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkflowCache, DEFAULT_TTL } from '../../../src/workflows/cache.js';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('WorkflowCache', () => {
  let cache: WorkflowCache;
  const testCacheDir = join(process.cwd(), '.cache-test');

  beforeEach(() => {
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true });
    }
    cache = new WorkflowCache(testCacheDir);
  });

  afterEach(() => {
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  it('should compute consistent cache keys', () => {
    const key1 = cache.computeCacheKey('test-workflow', { param1: 'value1' });
    const key2 = cache.computeCacheKey('test-workflow', { param1: 'value1' });
    const key3 = cache.computeCacheKey('test-workflow', { param1: 'value2' });

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('should store and retrieve cached results', async () => {
    const key = cache.computeCacheKey('test-workflow', { test: 'data' });
    
    await cache.set(key, 'test result', 'test-workflow', 3600);
    
    const result = await cache.get(key);
    expect(result).toBe('test result');
  });

  it('should return null for non-existent keys', async () => {
    const result = await cache.get('non-existent-key');
    expect(result).toBeNull();
  });

  it('should expire entries after TTL', async () => {
    const key = cache.computeCacheKey('test-workflow', { test: 'data' });
    
    // Set with 1 second TTL
    await cache.set(key, 'test result', 'test-workflow', 1);
    
    // Should be available immediately
    let result = await cache.get(key);
    expect(result).toBe('test result');
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Should be expired
    result = await cache.get(key);
    expect(result).toBeNull();
  });

  it('should track cache statistics', async () => {
    const key = cache.computeCacheKey('test-workflow', { test: 'data' });
    
    await cache.set(key, 'result', 'test-workflow', 3600);
    
    // Hit
    await cache.get(key);
    
    // Miss
    await cache.get('non-existent');
    
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.entries).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });

  it('should cleanup expired entries', async () => {
    const key1 = cache.computeCacheKey('workflow1', { test: '1' });
    const key2 = cache.computeCacheKey('workflow2', { test: '2' });
    
    await cache.set(key1, 'result1', 'workflow1', 1); // 1 second TTL
    await cache.set(key2, 'result2', 'workflow2', 3600); // 1 hour TTL
    
    expect(cache.getStats().entries).toBe(2);
    
    // Wait for first entry to expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const removed = cache.cleanup();
    expect(removed).toBe(1);
    expect(cache.getStats().entries).toBe(1);
  });

  it('should clear all cache', async () => {
    const key1 = cache.computeCacheKey('workflow1', { test: '1' });
    const key2 = cache.computeCacheKey('workflow2', { test: '2' });
    
    await cache.set(key1, 'result1', 'workflow1', 3600);
    await cache.set(key2, 'result2', 'workflow2', 3600);
    
    expect(cache.getStats().entries).toBe(2);
    
    cache.clear();
    
    expect(cache.getStats().entries).toBe(0);
    expect(cache.getStats().hits).toBe(0);
    expect(cache.getStats().misses).toBe(0);
  });

  it('should include file contents in cache key', () => {
    const params = { test: 'data' };
    const files1 = { 'file1.ts': 'content1' };
    const files2 = { 'file1.ts': 'content2' };
    
    const key1 = cache.computeCacheKey('workflow', params, files1);
    const key2 = cache.computeCacheKey('workflow', params, files2);
    
    expect(key1).not.toBe(key2);
  });

  it('should have default TTL configurations', () => {
    expect(DEFAULT_TTL['parallel-review']).toBe(3600);
    expect(DEFAULT_TTL['pre-commit-validate']).toBe(1800);
    expect(DEFAULT_TTL['bug-hunt']).toBe(1800);
  });
});
