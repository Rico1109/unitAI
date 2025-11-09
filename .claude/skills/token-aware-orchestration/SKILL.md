# Token-Aware Orchestration Skill

## Description
Automatic tool selection and workflow orchestration based on task complexity and token efficiency.

## When to Activate
**Patterns:**
- implement|add feature|create
- fix|bug|error|debug
- refactor|rename|reorganize
- analyze|review codebase
- large file operations
- multi-file modifications

## Priority
High - Activated proactively when detecting inefficient tool usage or complex multi-step tasks

## What This Skill Does

### 1. Token Estimation
- Estimates token cost BEFORE executing operations
- Classifies files: small (<300 LOC), medium (300-600), large (>600)
- Calculates potential savings with Serena vs Read (75-80% savings)

### 2. Tool Selection
Enforces intelligent tool selection rules:

| Task Type | Recommended Tool | Reason |
|-----------|------------------|---------|
| Code file reading | Serena (get_symbols_overview) | 75-80% token savings |
| Pattern search | claude-context (search_code) | Semantic search, BM25+vectors |
| Multi-file analysis | Workflow orchestration | Systematic approach |
| Refactoring | Serena (find_referencing_symbols) | Safe, surgical edits |

### 3. Workflow Orchestration
Automatically suggests workflows when patterns detected:

**Feature Implementation:**
```
1. claude-context → Find similar implementations
2. Serena → Map file structure (get_symbols_overview)
3. ask-gemini + ask-qwen (parallel) → Architecture review
4. ask-rovodev → Generate implementation
5. Serena → Verify no breakage (find_referencing_symbols)
```

**Bug Hunting:**
```
1. claude-context → Find related code/bugs
2. Serena → Analyze affected files
3. ask-gemini + ask-qwen (parallel) → Root cause analysis
4. Serena → Impact analysis (find_referencing_symbols)
5. Apply fix with Serena surgical edits
```

**Safe Refactoring:**
```
1. claude-context → Scope discovery
2. Serena → get_symbols_overview
3. Serena → find_referencing_symbols (CRITICAL - find ALL usages)
4. ask-gemini + ask-qwen (parallel) → Strategy validation
5. Serena → rename_symbol OR replace_symbol_body
```

## Decision Logic

### File Size Decision Tree
```
< 300 LOC:
  - Code file → Serena (still recommended for structure)
  - Non-code → Read ok

300-600 LOC:
  - Code file → Serena (REQUIRED)
  - Non-code → Consider ask-gemini for summarization

> 600 LOC:
  - Code file → Serena + claude-context
  - Non-code → Workflow (ask-gemini + ask-qwen analysis)
```

### Complexity Decision Tree
```
Single file, simple task:
  → Serena single-file approach

2-5 files, medium complexity:
  → Serena + claude-context

>5 files OR complex cross-cutting:
  → Full workflow orchestration
```

## Usage Examples

### Example 1: User asks to read large TypeScript file
```
User: "Read src/utils/aiExecutor.ts"

[Skill Activated]
❌ BLOCKED: Read tool not recommended for code files
✅ SUGGEST: mcp__serena__get_symbols_overview("src/utils/aiExecutor.ts")

Reason: aiExecutor.ts is 350 LOC (medium).
Using Serena saves ~260 tokens (75% savings).
```

### Example 2: User asks to implement new feature
```
User: "Implement OAuth login for the API"

[Skill Activated]
🎯 PATTERN DETECTED: Feature Implementation
📋 RECOMMENDED: feature-design workflow

Suggested execution:
1. mcp__claude-context__search_code("auth implementation")
2. mcp__serena__get_symbols_overview("src/auth/")
3. Parallel: ask-gemini + ask-qwen architecture analysis
4. ask-rovodev implementation generation
5. Serena impact verification
```

### Example 3: User searches for pattern in codebase
```
User: "Find all functions that handle user authentication"

[Skill Activated]
❌ BLOCKED: Grep not optimal for semantic search
✅ SUGGEST: mcp__claude-context__search_code(
  "user authentication functions",
  "/home/dawid/Projects/unified-ai-mcp-tool"
)

Reason: Semantic search finds related code beyond literal matches.
```

## Integration with CLAUDE.MD

This skill enforces rules from CLAUDE.MD sections:
- Section 3: File size decision tree
- Section 8: Integrated workflows
- Section 13: Autonomous enforcement (NEW)

## Skill Execution Flow

```
1. User submits prompt
   ↓
2. Analyze prompt for patterns
   ↓
3. Estimate task complexity
   ├─ File count
   ├─ File sizes (if known)
   └─ Pattern type (feature/bug/refactor)
   ↓
4. Select strategy:
   ├─ Simple → Serena single-file
   ├─ Medium → Serena + claude-context
   └─ Complex → Full workflow
   ↓
5. Output suggestion or execute workflow
   ↓
6. Monitor execution, provide feedback
```

## Activation Triggers

**Auto-activates when Claude is about to:**
- Use Read on .ts/.js/.py/.java/.go/.rs/.cpp files
- Use Grep on codebase
- Use Bash cat/grep commands
- Work on 3+ files simultaneously
- Implement features/fix bugs/refactor code

**Manual activation:**
User can invoke directly with patterns like:
- "Use token-aware orchestration for this task"
- "Help me decide the best approach for [task]"
- "Estimate token cost for reading these files"

## Dependencies

**MCP Tools:**
- mcp__serena__* (symbol-level navigation)
- mcp__claude-context__search_code (semantic search)
- mcp__unified-ai-mcp__ask-gemini (analysis)
- mcp__unified-ai-mcp__ask-qwen (analysis)
- mcp__unified-ai-mcp__ask-rovodev (implementation)
- mcp__unified-ai-mcp__smart-workflows (orchestration)

**Utilities:**
- src/utils/tokenEstimator.ts (token estimation)

## Configuration

No configuration required - skill activates automatically based on context detection.

## Expected Benefits

1. **Token Savings:** 50-80% reduction in context usage for code operations
2. **Better Results:** Semantic search and symbol navigation vs brute-force reading
3. **Systematic Approach:** Workflows ensure nothing is missed
4. **Safe Refactoring:** find_referencing_symbols prevents breaking changes
5. **Faster Execution:** Indexed search faster than full file reads

## Limitations

- Requires Serena MCP server to be running (uv installed)
- claude-context requires OpenAI API key for embeddings
- Workflow orchestration may increase latency for simple tasks
- Token estimates are approximate (±20% accuracy)

## Maintenance

- Update pattern detection as new use cases emerge
- Tune confidence thresholds based on false positive rate
- Add new workflows as they are implemented
- Monitor token savings metrics

---

**Version:** 1.0.0
**Last Updated:** 2025-11-09
**Maintainer:** unified-ai-mcp-tool
