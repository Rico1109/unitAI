/**
 * Unit tests for config.ts
 *
 * Tests for configuration helpers including dynamic backend selection (CFG-003)
 * Target Coverage: 85%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs module
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
}));

// Mock os module
vi.mock('os', () => ({
    homedir: vi.fn().mockReturnValue('/home/testuser'),
}));

// Import after mocks
import {
    getDefaultFallbackOrder,
    getFallbackPriority,
    getWorkflowBackends,
    loadConfig,
    createConfig,
    invalidateConfigCache,
    UnitAIConfig,
} from '../../src/config/config.js';
import { BACKENDS } from '../../src/constants.js';

describe('config.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateConfigCache();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getDefaultFallbackOrder', () => {
        it('returns the default fallback order', () => {
            const order = getDefaultFallbackOrder();

            expect(order).toEqual([
                BACKENDS.GEMINI,
                BACKENDS.QWEN,
                BACKENDS.DROID,
                BACKENDS.ROVODEV,
            ]);
        });

        it('returns an array with 4 backends', () => {
            const order = getDefaultFallbackOrder();
            expect(order).toHaveLength(4);
        });

        it('has GEMINI as the first priority', () => {
            const order = getDefaultFallbackOrder();
            expect(order[0]).toBe(BACKENDS.GEMINI);
        });
    });

    describe('getFallbackPriority', () => {
        it('returns configured priority when set', () => {
            const customOrder = [BACKENDS.QWEN, BACKENDS.GEMINI, BACKENDS.DROID];
            const mockConfig: UnitAIConfig = {
                version: '1.0',
                backends: { enabled: [], detected: [] },
                roles: { architect: 'gemini', implementer: 'droid', tester: 'qwen' },
                createdAt: '2026-01-01T00:00:00.000Z',
                lastModified: '2026-01-01T00:00:00.000Z',
                fallbackPriority: customOrder,
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const priority = getFallbackPriority();
            expect(priority).toEqual(customOrder);
        });

        it('returns default order when not configured', () => {
            const mockConfig: UnitAIConfig = {
                version: '1.0',
                backends: { enabled: [], detected: [] },
                roles: { architect: 'gemini', implementer: 'droid', tester: 'qwen' },
                createdAt: '2026-01-01T00:00:00.000Z',
                lastModified: '2026-01-01T00:00:00.000Z',
                // No fallbackPriority set
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const priority = getFallbackPriority();
            expect(priority).toEqual(getDefaultFallbackOrder());
        });

        it('returns default order when config file does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const priority = getFallbackPriority();
            expect(priority).toEqual(getDefaultFallbackOrder());
        });

        it('returns default order when fallbackPriority is empty array', () => {
            const mockConfig: UnitAIConfig = {
                version: '1.0',
                backends: { enabled: [], detected: [] },
                roles: { architect: 'gemini', implementer: 'droid', tester: 'qwen' },
                createdAt: '2026-01-01T00:00:00.000Z',
                lastModified: '2026-01-01T00:00:00.000Z',
                fallbackPriority: [], // Empty array
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const priority = getFallbackPriority();
            expect(priority).toEqual(getDefaultFallbackOrder());
        });
    });

    describe('getWorkflowBackends', () => {
        it('returns configured backends for workflow when set', () => {
            const mockConfig: UnitAIConfig = {
                version: '1.0',
                backends: { enabled: [], detected: [] },
                roles: { architect: 'gemini', implementer: 'droid', tester: 'qwen' },
                createdAt: '2026-01-01T00:00:00.000Z',
                lastModified: '2026-01-01T00:00:00.000Z',
                workflowDefaults: {
                    'parallel-review': {
                        backends: [BACKENDS.GEMINI, BACKENDS.QWEN],
                        maxParallel: 2,
                    },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const backends = getWorkflowBackends('parallel-review', [BACKENDS.DROID]);
            expect(backends).toEqual([BACKENDS.GEMINI, BACKENDS.QWEN]);
        });

        it('returns defaults when workflow not configured', () => {
            const mockConfig: UnitAIConfig = {
                version: '1.0',
                backends: { enabled: [], detected: [] },
                roles: { architect: 'gemini', implementer: 'droid', tester: 'qwen' },
                createdAt: '2026-01-01T00:00:00.000Z',
                lastModified: '2026-01-01T00:00:00.000Z',
                workflowDefaults: {},
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const defaults = [BACKENDS.DROID, BACKENDS.QWEN];
            const backends = getWorkflowBackends('unknown-workflow', defaults);
            expect(backends).toEqual(defaults);
        });

        it('returns defaults when no config exists', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const defaults = [BACKENDS.GEMINI];
            const backends = getWorkflowBackends('parallel-review', defaults);
            expect(backends).toEqual(defaults);
        });

        it('returns defaults when workflow backends is empty array', () => {
            const mockConfig: UnitAIConfig = {
                version: '1.0',
                backends: { enabled: [], detected: [] },
                roles: { architect: 'gemini', implementer: 'droid', tester: 'qwen' },
                createdAt: '2026-01-01T00:00:00.000Z',
                lastModified: '2026-01-01T00:00:00.000Z',
                workflowDefaults: {
                    'parallel-review': {
                        backends: [], // Empty
                    },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            const defaults = [BACKENDS.DROID];
            const backends = getWorkflowBackends('parallel-review', defaults);
            expect(backends).toEqual(defaults);
        });
    });

    describe('createConfig', () => {
        it('includes fallbackPriority when provided', () => {
            const config = createConfig({
                enabledBackends: [BACKENDS.GEMINI, BACKENDS.QWEN],
                detectedBackends: [BACKENDS.GEMINI, BACKENDS.QWEN, BACKENDS.DROID],
                roles: { architect: 'gemini', implementer: 'qwen', tester: 'qwen' },
                fallbackPriority: [BACKENDS.QWEN, BACKENDS.GEMINI],
            });

            expect(config.fallbackPriority).toEqual([BACKENDS.QWEN, BACKENDS.GEMINI]);
        });

        it('creates config without optional fields', () => {
            const config = createConfig({
                enabledBackends: [BACKENDS.GEMINI],
                detectedBackends: [BACKENDS.GEMINI],
                roles: { architect: 'gemini', implementer: 'gemini', tester: 'gemini' },
            });

            expect(config.fallbackPriority).toBeUndefined();
            expect(config.workflowDefaults).toBeUndefined();
            expect(config.preferences).toBeUndefined();
        });

        it('includes workflowDefaults when provided', () => {
            const config = createConfig({
                enabledBackends: [BACKENDS.GEMINI],
                detectedBackends: [BACKENDS.GEMINI],
                roles: { architect: 'gemini', implementer: 'gemini', tester: 'gemini' },
                workflowDefaults: {
                    'bug-hunt': {
                        backends: [BACKENDS.QWEN],
                        maxParallel: 1,
                    },
                },
            });

            expect(config.workflowDefaults).toEqual({
                'bug-hunt': {
                    backends: [BACKENDS.QWEN],
                    maxParallel: 1,
                },
            });
        });

        it('includes preferences when provided', () => {
            const config = createConfig({
                enabledBackends: [BACKENDS.GEMINI],
                detectedBackends: [BACKENDS.GEMINI],
                roles: { architect: 'gemini', implementer: 'gemini', tester: 'gemini' },
                preferences: {
                    preferAvailable: true,
                    retryWithFallback: false,
                },
            });

            expect(config.preferences).toEqual({
                preferAvailable: true,
                retryWithFallback: false,
            });
        });
    });

    describe('loadConfig cache', () => {
        it('reads the filesystem only once across two consecutive calls', () => {
            const mockConfig: UnitAIConfig = {
                version: '1.0',
                backends: { enabled: [], detected: [] },
                roles: { architect: 'gemini', implementer: 'droid', tester: 'qwen' },
                createdAt: '2026-01-01T00:00:00.000Z',
                lastModified: '2026-01-01T00:00:00.000Z',
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            loadConfig();
            loadConfig();

            expect(fs.readFileSync).toHaveBeenCalledTimes(1);
        });

        it('re-reads the filesystem after invalidateConfigCache()', () => {
            const mockConfig: UnitAIConfig = {
                version: '1.0',
                backends: { enabled: [], detected: [] },
                roles: { architect: 'gemini', implementer: 'droid', tester: 'qwen' },
                createdAt: '2026-01-01T00:00:00.000Z',
                lastModified: '2026-01-01T00:00:00.000Z',
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

            loadConfig();
            invalidateConfigCache();
            loadConfig();

            expect(fs.readFileSync).toHaveBeenCalledTimes(2);
        });

        it('does not cache when config file does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const first = loadConfig();
            const second = loadConfig();

            expect(first).toBeNull();
            expect(second).toBeNull();
            // existsSync called twice (once per loadConfig — no caching on null result)
            expect(fs.existsSync).toHaveBeenCalledTimes(2);
        });
    });
});
