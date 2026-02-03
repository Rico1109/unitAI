#!/usr/bin/env node
/**
 * unitAI Health Check
 * 
 * Quick health check command showing backend status and role mapping.
 * Run with: unitai health
 */

import { spawnSync } from 'child_process';
import { detectBackends, BACKEND_METADATA } from '../config/backend-detector.js';
import { loadConfig, getConfigPath, getConfigAge } from '../config/config.js';

interface BackendStatus {
    name: string;
    available: boolean;
    responseTime?: number;
    error?: string;
}

/**
 * Test a backend by running a simple command
 */
async function testBackend(command: string): Promise<{ success: boolean; timeMs: number; error?: string }> {
    const start = Date.now();
    try {
        // SECURITY: Use spawnSync with shell:false to prevent command injection (SEC-005)
        const result = spawnSync('which', [command], {
            stdio: 'ignore',
            shell: false,  // Prevents shell interpretation
            timeout: 5000
        });
        return {
            success: result.status === 0,
            timeMs: Date.now() - start
        };
    } catch (error) {
        return { success: false, timeMs: Date.now() - start, error: 'not installed' };
    }
}

/**
 * Print colored text to console
 */
function log(text: string) {
    console.log(text);
}

function green(text: string): string {
    return `\x1b[32m${text}\x1b[0m`;
}

function red(text: string): string {
    return `\x1b[31m${text}\x1b[0m`;
}

function yellow(text: string): string {
    return `\x1b[33m${text}\x1b[0m`;
}

function dim(text: string): string {
    return `\x1b[2m${text}\x1b[0m`;
}

function bold(text: string): string {
    return `\x1b[1m${text}\x1b[0m`;
}

/**
 * Run the health check
 */
export async function runHealthCheck() {
    log('');
    log(bold('🏥 unitAI Health Check'));
    log('──────────────────────────────');

    // Check backends
    log('');
    log(bold('Backends:'));
    const backends = detectBackends();

    for (const backend of backends) {
        const status = await testBackend(backend.command);
        if (status.success) {
            log(`  ${green('✓')} ${backend.name.padEnd(10)} ${dim(`${status.timeMs}ms`)}`);
        } else {
            log(`  ${red('✗')} ${backend.name.padEnd(10)} ${dim(status.error || 'unavailable')}`);
        }
    }

    // Check roles
    log('');
    log(bold('Roles:'));
    const config = loadConfig();

    if (config) {
        const enabledSet = new Set(config.backends.enabled);
        log(`  Architect   → ${config.roles.architect} ${enabledSet.has(config.roles.architect) ? green('✓') : red('(disabled)')}`);
        log(`  Implementer → ${config.roles.implementer} ${enabledSet.has(config.roles.implementer) ? green('✓') : red('(disabled)')}`);
        log(`  Tester      → ${config.roles.tester} ${enabledSet.has(config.roles.tester) ? green('✓') : red('(disabled)')}`);
    } else {
        log(`  ${yellow('No config found')} - using defaults`);
        log(`  Architect   → gemini ${dim('(default)')}`);
        log(`  Implementer → droid ${dim('(default)')}`);
        log(`  Tester      → qwen ${dim('(default)')}`);
    }

    // Config info
    log('');
    if (config) {
        const age = getConfigAge();
        log(`Config: ${getConfigPath()} ${dim(`(${age})`)}`);
    } else {
        log(`Config: ${dim('not configured - run')} ${yellow('unitai setup')}`);
    }

    log('');
}

// CLI entry point
if (process.argv[1]?.endsWith('health.js') || process.argv[1]?.endsWith('health.ts')) {
    runHealthCheck();
}
