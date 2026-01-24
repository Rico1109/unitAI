---
title: unitAI Architecture SSOT
version: 2.1.0
updated: 2026-01-24T17:00:00+01:00
scope: unitai-architecture
category: ssot
subcategory: architecture
domain: [mcp, typescript, ai-orchestration]
changelog:
  - 2.1.0 (2026-01-24): Updated DI container to include auditDb and tokenDb.
  - 2.0.0 (2026-01-24): Complete rewrite for zero-context readers.
  - 1.0.0 (2026-01-24): Initial draft.
---

# unitAI Architecture

## What is unitAI

unitAI is an **MCP Server** (Model Context Protocol) that allows AI assistants like Claude to orchestrate multiple AI CLI backends. It acts as a middleware between Claude and various AI coding tools.

**Version**: 0.4.0  
**Language**: TypeScript  
**Location**: `/home/rico/Projects/CodeBase/unitAI`

### Supported Backends

| Backend | CLI Command | Purpose |
|---------|-------------|---------|
| Gemini | `gemini` | Deep reasoning, architecture |
| Droid | `droid` | Autonomous execution (GLM-4.6) |
| Qwen | `qwen` | Fast implementation |
| Rovodev | `rovodev` | Safe experiments |
| Cursor | `cursor-agent` | IDE integration |

---

## Project Structure

```
unitAI/
├── src/
│   ├── index.ts              # Entry point (thin wrapper)
│   ├── server.ts             # UnitAIServer class
│   ├── dependencies.ts       # DI container
│   ├── constants.ts          # BACKENDS, CLI flags, config
│   │
│   ├── tools/                # MCP Tools (exposed to Claude)
│   │   ├── index.ts          # Tool registration
│   │   ├── registry.ts       # Tool registry + execution
│   │   ├── ask-gemini.tool.ts
│   │   ├── ask-qwen.tool.ts
│   │   ├── droid.tool.ts
│   │   └── workflows/        # Workflow tools
│   │
│   ├── agents/               # Agent abstractions
│   │   ├── index.ts          # AgentFactory
│   │   ├── ArchitectAgent.ts
│   │   ├── ImplementerAgent.ts
│   │   └── TesterAgent.ts
│   │
│   ├── workflows/            # Workflow definitions
│   │   ├── index.ts          # Workflow registry
│   │   ├── modelSelector.ts  # Backend selection logic
│   │   ├── workflowContext.ts # In-memory context
│   │   └── *.workflow.ts     # 10 workflow implementations
│   │
│   ├── utils/
│   │   ├── aiExecutor.ts     # CLI execution hub
│   │   ├── commandExecutor.ts # spawn wrapper
│   │   ├── circuitBreaker.ts # Failure handling
│   │   ├── permissionManager.ts # 4-tier autonomy
│   │   ├── auditTrail.ts     # SQLite audit log
│   │   └── logger.ts         # Logging
│   │
│   ├── config/               # Configuration
│   │   ├── config.ts         # ~/.unitai/config.json
│   │   └── detectBackends.ts # CLI availability check
│   │
│   ├── services/
│   │   └── activityAnalytics.ts # Usage tracking
│   │
│   └── repositories/         # Data access layer
│       ├── base.ts
│       └── activity.ts
│
├── data/                     # Runtime data (SQLite DBs)
├── cli/                      # TUI wizard
└── package.json
```

---

## How It Works

### 1. Server Startup

```
index.ts → UnitAIServer.constructor() → initializeDependencies() → setupHandlers()
```

`UnitAIServer` creates an MCP Server, registers tools, and connects via stdio transport.

### 2. Tool Registration

All tools are registered in `tools/index.ts`:
```typescript
registerTool(askGeminiTool);
registerTool(askQwenTool);
registerTool(droidTool);
registerTool(smartWorkflowsTool);
// ... 15 tools total
```

### 3. Tool Execution Flow

```
Claude sends CallToolRequest
    ↓
server.ts receives request
    ↓
registry.executeTool(name, args)
    ↓
Zod validates arguments against tool.zodSchema
    ↓
tool.execute(validatedArgs, onProgress)
    ↓
(for AI tools) aiExecutor.executeAIClient(options)
    ↓
circuitBreaker.isAvailable(backend)?
    ├─ YES → spawn CLI process
    └─ NO  → selectFallbackBackend() → retry
    ↓
Response string returned to Claude
```

### 4. Backend Execution

`aiExecutor.ts` contains per-backend functions:
- `executeGeminiCLI(options)` → spawns `gemini` CLI
- `executeDroidCLI(options)` → spawns `droid` CLI
- `executeQwenCLI(options)` → spawns `qwen` CLI
- etc.

All use `commandExecutor.ts` which wraps Node.js `spawn` with timeout handling.

### 5. Circuit Breaker

Tracks backend failures:
- **CLOSED**: Normal operation
- **OPEN**: 3+ failures, blocks requests for 5 minutes
- **HALF_OPEN**: After timeout, allows one test request

### 6. Model Selection

`modelSelector.ts` chooses backend based on task characteristics:
```typescript
interface TaskCharacteristics {
  complexity: 'low' | 'medium' | 'high';
  requiresArchitecturalThinking: boolean;
  requiresCodeGeneration: boolean;
  requiresSpeed: boolean;
  // ...
}
```

---

## Key Components Detail

### dependencies.ts (DI Container)

**Central dependency injection container managing all database connections.**

```typescript
export interface AppDependencies {
  activityDb: Database.Database;   // MCP activity tracking
  auditDb: Database.Database;      // Autonomous operations audit trail
  tokenDb: Database.Database;      // Token savings metrics
}

let dependencies: AppDependencies | null = null;

export function initializeDependencies(): AppDependencies { ... }
export function getDependencies(): AppDependencies { ... }
export function closeDependencies(): void { ... }
```

**Lifecycle:**
- `initializeDependencies()`: Creates `data/` directory, opens all DBs with WAL mode
- `getDependencies()`: Returns singleton instance (throws if not initialized)
- `closeDependencies()`: Closes all DB connections, resets singleton

**Database files:**
- `data/activity.sqlite` - Activity analytics repository
- `data/audit.sqlite` - Audit trail for permission system
- `data/token-metrics.sqlite` - Token savings tracking

**Factory Pattern:**
Components that need DB access use factory functions instead of direct instantiation:

```typescript
// AuditTrail factory (lazy singleton)
export function getAuditTrail(): AuditTrail {
  if (!auditTrailInstance) {
    const deps = getDependencies();
    auditTrailInstance = new AuditTrail(deps.auditDb);
  }
  return auditTrailInstance;
}

// TokenSavingsMetrics factory (lazy singleton)
export function getMetricsCollector(): TokenSavingsMetrics {
  if (!metricsInstance) {
    const deps = getDependencies();
    metricsInstance = new TokenSavingsMetrics(deps.tokenDb);
  }
  return metricsInstance;
}

// ActivityAnalytics factory
export function getActivityAnalytics(): ActivityAnalytics {
  if (!analyticsInstance) {
    const deps = getDependencies();
    const repo = new ActivityRepository(deps.activityDb);
    const audit = getAuditTrail();
    const tokens = getMetricsCollector();
    analyticsInstance = new ActivityAnalytics(repo, audit, tokens);
  }
  return analyticsInstance;
}
```

This pattern ensures:
- ✅ Single point of DB initialization
- ✅ Testability (inject mock DBs)
- ✅ Proper lifecycle management
- ✅ No scattered `new Database()` calls

---

### config/config.ts (Configuration)

Stores config in `~/.unitai/config.json`:
```typescript
interface UnitAIConfig {
  version: string;
  backends: { enabled: string[]; detected: string[] };
  roles: {
    architect: string;   // e.g., "gemini"
    implementer: string; // e.g., "droid"
    tester: string;      // e.g., "qwen"
  };
}
```

`getRoleBackend(role)` reads this file to determine which backend to use.

---

### agents/index.ts (AgentFactory)

Creates specialized agents:
```typescript
AgentFactory.createArchitect() → uses backend from config.roles.architect
AgentFactory.createImplementer() → uses backend from config.roles.implementer
AgentFactory.createTester() → uses backend from config.roles.tester
```

---

### workflows/workflowContext.ts (Workflow Memory)

In-memory context for workflow execution:
```typescript
class WorkflowContext {
  private data: Map<string, any>;
  private arrays: Map<string, any[]>;
  private counters: Map<string, number>;
  private checkpoints: Map<string, Checkpoint>;
  
  set<T>(key, value), get<T>(key), append<T>(key, value)
  checkpoint(name), rollback(name)
}
```

Not persisted - lost when workflow ends.

---

### utils/permissionManager.ts (Autonomy Levels)

4-tier permission system:
| Level | Allowed Operations |
|-------|-------------------|
| READ_ONLY | file reads, git status |
| LOW | file writes |
| MEDIUM | git commit, install deps, execute commands |
| HIGH | git push, external APIs |

---

## Shared State

| Component | Storage | Lifecycle | Managed By |
|-----------|---------|-----------|------------|
| `dependencies` | Memory (singleton) | Server lifetime | DI Container |
| `activityDb` | SQLite `data/activity.sqlite` | Persisted | DI Container ✅ |
| `auditDb` | SQLite `data/audit.sqlite` | Persisted | DI Container ✅ |
| `tokenDb` | SQLite `data/token-metrics.sqlite` | Persisted | DI Container ✅ |
| `auditTrail` | Lazy singleton (uses `auditDb`) | Server lifetime | Factory function |
| `tokenMetrics` | Lazy singleton (uses `tokenDb`) | Server lifetime | Factory function |
| `backendStats` | Memory (Map) | Lost on restart | Self-managed |
| `circuitBreaker` | Memory (singleton) | Lost on restart | Self-managed |
| `toolRegistry` | Memory (array) | Populated at startup | Self-managed |
| `config.json` | File `~/.unitai/` | Persisted | File system |

**Note:** All SQLite databases are now centrally managed through the DI container, ensuring proper lifecycle management and testability.

---

## Existing Tests

Location: `tests/unit/`, `tests/integration/`

Run tests:
```bash
npm test          # vitest
npm run lint      # tsc --noEmit
npm run build     # tsc
```

**Test status (v2.1.0):**
- ✅ Build: Passing
- ✅ Tests: 239/241 passing (99.2%)
- ⚠️ 2 minor failures (unrelated to DI)
- 🎉 Fixed 19 DI-related test failures

**Test infrastructure:**
- `tests/utils/testDependencies.ts` - In-memory DB helper for unit tests
- All tests now use proper DI injection pattern

---

## Build & Run

```bash
cd /home/rico/Projects/CodeBase/unitAI
npm install
npm run build
npm start         # Starts MCP server on stdio
```

CLI wizard:
```bash
npm run setup     # Interactive configuration
```

---

## File Quick Reference

| Need to... | Look at... |
|------------|-----------|
| Add new tool | `tools/*.tool.ts`, register in `tools/index.ts` |
| Add new backend | `aiExecutor.ts`, `constants.ts` |
| Modify DI | `dependencies.ts` |
| Add workflow | `workflows/*.workflow.ts`, register in `workflows/index.ts` |
| Change config | `config/config.ts` |
| Modify permissions | `utils/permissionManager.ts` |
| Backend selection | `workflows/modelSelector.ts` |
