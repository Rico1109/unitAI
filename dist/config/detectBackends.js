/**
 * Backend Detection Module
 *
 * Detects which AI CLI backends are available on the system.
 */
import { spawnSync } from 'child_process';
import { logger } from '../utils/logger.js';
/**
 * All supported backends with their metadata
 */
export const BACKEND_METADATA = {
    gemini: {
        name: 'gemini',
        command: 'gemini',
        description: 'Deep reasoning, architecture analysis',
        recommended: { role: 'architect' }
    },
    droid: {
        name: 'droid',
        command: 'droid',
        description: 'Autonomous agentic execution (GLM-4.6)',
        recommended: { role: 'implementer' }
    },
    qwen: {
        name: 'qwen',
        command: 'qwen',
        description: 'Fast implementation, refactoring',
        recommended: { role: 'tester' }
    },
    rovodev: {
        name: 'rovodev',
        command: 'rovodev',
        description: 'Shadow mode, safe experiments'
    },
    cursor: {
        name: 'cursor',
        command: 'cursor-agent',
        description: 'Code editing via Cursor'
    }
};
/**
 * Check if a CLI command is available on the system
 */
function isCommandAvailable(command) {
    // SECURITY: Whitelist of allowed backend commands to prevent command injection
    const ALLOWED_BACKEND_COMMANDS = [
        'gemini',
        'droid',
        'qwen',
        'cursor-agent',
        'rovodev'
    ];
    // 1. Whitelist check FIRST - reject unknown commands
    if (!ALLOWED_BACKEND_COMMANDS.includes(command)) {
        logger.warn(`Rejected unknown command: ${command}`);
        return false;
    }
    try {
        // 2. Use spawnSync with shell: false to prevent command injection
        const result = spawnSync('which', [command], {
            stdio: 'ignore',
            shell: false, // Critical: prevents shell interpretation
            timeout: 5000 // 5 second timeout
        });
        return result.status === 0;
    }
    catch {
        return false;
    }
}
/**
 * Detect all available backends on the system
 */
export function detectBackends() {
    return Object.entries(BACKEND_METADATA).map(([key, meta]) => ({
        ...meta,
        available: isCommandAvailable(meta.command)
    }));
}
/**
 * Get only available backends
 */
export function getAvailableBackends() {
    return detectBackends().filter(b => b.available);
}
/**
 * Get backend by name
 */
export function getBackend(name) {
    const meta = BACKEND_METADATA[name];
    if (!meta)
        return undefined;
    return {
        ...meta,
        available: isCommandAvailable(meta.command)
    };
}
//# sourceMappingURL=detectBackends.js.map