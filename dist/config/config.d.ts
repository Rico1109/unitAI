/**
 * Configuration Management Module
 *
 * Handles loading, saving, and validating unitAI configuration.
 * Config is stored at ~/.unitai/config.json
 */
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
/**
 * Default configuration when none exists
 */
export declare const DEFAULT_CONFIG: UnitAIConfig;
/**
 * Check if config file exists
 */
export declare function configExists(): boolean;
/**
 * Get config file path
 */
export declare function getConfigPath(): string;
/**
 * Load configuration from disk
 */
export declare function loadConfig(): UnitAIConfig | null;
/**
 * Save configuration to disk
 */
export declare function saveConfig(config: UnitAIConfig): boolean;
/**
 * Create a new config with the given options
 */
export declare function createConfig(options: {
    enabledBackends: string[];
    detectedBackends: string[];
    roles: {
        architect: string;
        implementer: string;
        tester: string;
    };
}): UnitAIConfig;
/**
 * Get the role mapping from config, falling back to defaults
 */
export declare function getRoleBackend(role: 'architect' | 'implementer' | 'tester'): string;
/**
 * Check if a backend is enabled in the config
 */
export declare function isBackendEnabled(backend: string): boolean;
/**
 * Get config age in human-readable format
 */
export declare function getConfigAge(): string | null;
//# sourceMappingURL=config.d.ts.map