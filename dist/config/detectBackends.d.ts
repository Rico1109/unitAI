/**
 * Backend Detection Module
 *
 * Detects which AI CLI backends are available on the system.
 */
export interface BackendInfo {
    name: string;
    command: string;
    description: string;
    available: boolean;
    recommended?: {
        role: 'architect' | 'implementer' | 'tester';
    };
}
/**
 * All supported backends with their metadata
 */
export declare const BACKEND_METADATA: Record<string, Omit<BackendInfo, 'available'>>;
/**
 * Detect all available backends on the system
 */
export declare function detectBackends(): BackendInfo[];
/**
 * Get only available backends
 */
export declare function getAvailableBackends(): BackendInfo[];
/**
 * Get backend by name
 */
export declare function getBackend(name: string): BackendInfo | undefined;
//# sourceMappingURL=detectBackends.d.ts.map