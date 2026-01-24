/**
 * Agent Factory - Centralized agent creation and management
 *
 * Provides:
 * - Factory methods for creating specific agents
 * - Dynamic agent creation by type
 * - Agent registry and metadata
 * - Type-safe agent instantiation
 *
 * @module agents/index
 */
import { ArchitectAgent } from "./ArchitectAgent.js";
import { ImplementerAgent } from "./ImplementerAgent.js";
import { TesterAgent } from "./TesterAgent.js";
import { BACKENDS } from "../constants.js";
import { getRoleBackend } from "../config/index.js";
/**
 * Helper to map config backend name to internal backend ID
 */
function resolveBackend(configName) {
    switch (configName.toLowerCase()) {
        case 'gemini': return BACKENDS.GEMINI;
        case 'droid': return BACKENDS.DROID;
        case 'qwen': return BACKENDS.QWEN;
        case 'vibe': return BACKENDS.VIBE;
        case 'rovodev': return BACKENDS.ROVODEV;
        case 'cursor': return BACKENDS.CURSOR;
        default: return configName;
    }
}
/**
 * Agent types supported by the factory
 */
export var AgentType;
(function (AgentType) {
    AgentType["ARCHITECT"] = "architect";
    AgentType["IMPLEMENTER"] = "implementer";
    AgentType["TESTER"] = "tester";
})(AgentType || (AgentType = {}));
/**
 * AgentFactory - Factory pattern for creating agents
 *
 * Usage:
 * ```typescript
 * // Create specific agent
 * const architect = AgentFactory.createArchitect();
 * const implementer = AgentFactory.createImplementer();
 *
 * // Create agent by type
 * const agent = AgentFactory.createAgent(AgentType.ARCHITECT);
 *
 * // Get available agents
 * const agents = AgentFactory.getAvailableAgents();
 * ```
 */
export class AgentFactory {
    /**
     * Create an ArchitectAgent instance
     *
     * Specializes in:
     * - System design and architecture
     * - Security analysis
     * - Refactoring strategies
     * - Performance optimization
     *
     * Backend: Configurable (default: Gemini)
     *
     * @returns New ArchitectAgent instance
     */
    static createArchitect() {
        const backend = resolveBackend(getRoleBackend('architect'));
        return new ArchitectAgent({ preferredBackend: backend });
    }
    /**
     * Create an ImplementerAgent instance
     *
     * Specializes in:
     * - Production-ready code generation
     * - Bug fixing
     * - Incremental implementation
     * - Code quality and best practices
     *
     * Backend: Configurable (default: Droid)
     *
     * @returns New ImplementerAgent instance
     */
    static createImplementer() {
        const backend = resolveBackend(getRoleBackend('implementer'));
        return new ImplementerAgent({ preferredBackend: backend });
    }
    /**
     * Create a TesterAgent instance
     *
     * Specializes in:
     * - Unit test generation
     * - Integration test generation
     * - Test coverage analysis
     * - Fast iteration on test cases
     *
     * Backend: Configurable (default: Cursor Agent)
     *
     * @returns New TesterAgent instance
     */
    static createTester() {
        const backend = resolveBackend(getRoleBackend('tester'));
        return new TesterAgent({ preferredBackend: backend });
    }
    /**
     * Create an agent dynamically by type
     *
     * @param type - Agent type to create
     * @returns Agent instance
     * @throws Error if agent type is unknown
     */
    static createAgent(type) {
        switch (type) {
            case AgentType.ARCHITECT:
                return this.createArchitect();
            case AgentType.IMPLEMENTER:
                return this.createImplementer();
            case AgentType.TESTER:
                return this.createTester();
            default:
                throw new Error(`Unknown agent type: ${type}`);
        }
    }
    /**
     * Get metadata for all available agents
     *
     * Useful for:
     * - UI selection menus
     * - Documentation generation
     * - Runtime discovery
     *
     * @returns Array of agent metadata
     */
    static getAvailableAgents() {
        const architect = new ArchitectAgent();
        const implementer = new ImplementerAgent();
        const tester = new TesterAgent();
        return [
            {
                type: AgentType.ARCHITECT,
                name: architect.name,
                description: architect.description,
                preferredBackend: architect.preferredBackend,
                fallbackBackend: architect.fallbackBackend,
                specialization: "High-level system design, architecture analysis, and strategic planning"
            },
            {
                type: AgentType.IMPLEMENTER,
                name: implementer.name,
                description: implementer.description,
                preferredBackend: implementer.preferredBackend,
                fallbackBackend: implementer.fallbackBackend,
                specialization: "Precise code implementation with production-quality standards"
            },
            {
                type: AgentType.TESTER,
                name: tester.name,
                description: tester.description,
                preferredBackend: tester.preferredBackend,
                fallbackBackend: tester.fallbackBackend,
                specialization: "Fast test generation and validation"
            }
        ];
    }
    /**
     * Get agent by name (case-insensitive)
     *
     * @param name - Agent name to search for
     * @returns Agent instance or undefined if not found
     */
    static getAgentByName(name) {
        const normalizedName = name.toLowerCase();
        const agents = this.getAvailableAgents();
        const agentInfo = agents.find(a => a.name.toLowerCase() === normalizedName ||
            a.type.toLowerCase() === normalizedName);
        return agentInfo ? this.createAgent(agentInfo.type) : undefined;
    }
}
// Re-export types and classes for convenience
export { ArchitectAgent } from "./ArchitectAgent.js";
export { ImplementerAgent } from "./ImplementerAgent.js";
export { TesterAgent } from "./TesterAgent.js";
export { BaseAgent } from "./base/BaseAgent.js";
export * from "./types.js";
//# sourceMappingURL=index.js.map