# Architectural Guidelines & Design Patterns

## Core Principles

### 1. Progressive Disclosure
Skills and documentation should be concise in main files (<500 lines), with detailed documentation in `ref/` subdirectories loaded on-demand.

### 2. Recursive MCP Architecture
**Key Insight**: `unified-ai-mcp-tool` can invoke ALL other MCP servers when running workflows.

**Power Multiplier:**
```typescript
// Workflow can orchestrate:
await claudeContext.search(query);     // Semantic search
await serena.findSymbol(name);         // Symbol navigation
await context7.getDocs(library);       // API docs
await gemini.analyze(code);            // AI reasoning
await serena.replaceSymbolBody(code);  // Code modification
await openmemory.store(learning);      // Persist knowledge
```

### 3. Tool-Based Architecture
- Each AI backend = 1 MCP tool (`ask-qwen`, `ask-rovodev`, `ask-gemini`)
- Smart workflows = orchestration layer
- Utilities = shared logic (aiExecutor, gitHelper, logger)

### 4. Workflow Pattern
```typescript
// src/workflows/*.workflow.ts
export async function workflowName(params: WorkflowParams): Promise<WorkflowResult> {
  // 1. Validate params
  // 2. Execute orchestration (can use MCP calls!)
  // 3. Return structured result
}
```

## Design Patterns

### Registry Pattern
- `src/tools/registry.ts`: Centralized tool registration
- `src/workflows/index.ts`: Centralized workflow registration

### Executor Pattern
- `src/utils/aiExecutor.ts`: Unified CLI execution for all AI backends
- Handles: Qwen, Rovodev, Gemini CLIs
- Returns: Standardized `AIExecutionResult`

### Strategy Pattern
- Model selection based on task complexity
- Qwen: Fast, low-cost
- Gemini: Complex analysis, refactoring
- Rovodev: Production code, bug fixing

## Best Practices

### MCP Tool Creation
1. Define Zod schema for params
2. Implement handler function
3. Register in `src/tools/registry.ts`
4. Document in README.md

### Workflow Creation
1. Define types in `src/workflows/types.ts`
2. Implement in `src/workflows/*.workflow.ts`
3. Register in `src/workflows/index.ts`
4. Add to smart-workflows.tool.ts cases
5. Document in README.md

### Error Handling
```typescript
try {
  const result = await executeAI(...);
  if (!result.success) {
    return { success: false, error: result.error };
  }
} catch (error) {
  logger.error(`Workflow failed: ${error}`);
  return { success: false, error: error.message };
}
```

### File References
- Support `@filename` and `#filename` syntax
- Handle directories with trailing `/`
- Resolve relative to working directory

## Anti-Patterns to Avoid
- ❌ Direct CLI calls outside aiExecutor
- ❌ Hardcoded paths (use constants.ts)
- ❌ Monolithic workflows (break into utils)
- ❌ Missing error handling
- ❌ Workflow without Zod validation
