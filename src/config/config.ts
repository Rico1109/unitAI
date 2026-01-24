/**
 * Configuration Management Module
 * 
 * Handles loading, saving, and validating unitAI configuration.
 * Config is stored at ~/.unitai/config.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface UnitAIConfig {
    version: string;
    backends: {
        enabled: string[];
        detected: string[];
    };
    roles: {
        architect: string;
        implementer: string;
        tester: string;
    };
    createdAt: string;
    lastModified: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.unitai');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const CONFIG_VERSION = '1.0';

/**
 * Default configuration when none exists
 */
export const DEFAULT_CONFIG: UnitAIConfig = {
    version: CONFIG_VERSION,
    backends: {
        enabled: [],
        detected: []
    },
    roles: {
        architect: 'gemini',
        implementer: 'droid',
        tester: 'qwen'
    },
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
};

/**
 * Check if config file exists
 */
export function configExists(): boolean {
    return fs.existsSync(CONFIG_PATH);
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
    return CONFIG_PATH;
}

/**
 * Load configuration from disk
 */
export function loadConfig(): UnitAIConfig | null {
    try {
        if (!configExists()) {
            return null;
        }

        const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(content) as UnitAIConfig;

        // Validate basic structure
        if (!config.version || !config.roles || !config.backends) {
            console.error('Invalid config structure, using defaults');
            return null;
        }

        return config;
    } catch (error) {
        console.error('Failed to load config:', error);
        return null;
    }
}

/**
 * Save configuration to disk
 */
export function saveConfig(config: UnitAIConfig): boolean {
    try {
        // Ensure config directory exists
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }

        // Update lastModified
        config.lastModified = new Date().toISOString();

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Failed to save config:', error);
        return false;
    }
}

/**
 * Create a new config with the given options
 */
export function createConfig(options: {
    enabledBackends: string[];
    detectedBackends: string[];
    roles: {
        architect: string;
        implementer: string;
        tester: string;
    };
}): UnitAIConfig {
    return {
        version: CONFIG_VERSION,
        backends: {
            enabled: options.enabledBackends,
            detected: options.detectedBackends
        },
        roles: options.roles,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
    };
}

/**
 * Get the role mapping from config, falling back to defaults
 */
export function getRoleBackend(role: 'architect' | 'implementer' | 'tester'): string {
    const config = loadConfig();
    if (config && config.roles[role]) {
        return config.roles[role];
    }
    return DEFAULT_CONFIG.roles[role];
}

/**
 * Check if a backend is enabled in the config
 */
export function isBackendEnabled(backend: string): boolean {
    const config = loadConfig();
    if (!config) {
        // No config = all backends enabled by default
        return true;
    }
    return config.backends.enabled.includes(backend);
}

/**
 * Get config age in human-readable format
 */
export function getConfigAge(): string | null {
    const config = loadConfig();
    if (!config) return null;

    const created = new Date(config.lastModified);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return '1 day old';
    return `${diffDays} days old`;
}
