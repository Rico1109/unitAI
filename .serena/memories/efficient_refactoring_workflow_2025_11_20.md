# Efficient Refactoring Workflow - MCP Tools Integration (November 20, 2025)

## Context
Successfully completed a large-scale codebase refactoring (backend naming convention) using multiple MCP tools in an efficient, coordinated manner.

## Tools Used Strategically

### 1. Serena MCP (Symbol-level LSP)
**Use Cases:**
- Finding symbol definitions and references
- Precise symbol-level editing (replace_symbol_body)
- Navigating TypeScript/JavaScript codebase structure
- Reading specific code sections without loading entire files

**Benefits:**
- 75-80% token savings vs full file reads
- Surgical precision for code changes
- Type-safe symbol navigation
- Fast symbol lookups

**Examples from Today:**
```typescript
// Found and replaced BACKENDS constant
mcp__serena__find_symbol -> mcp__serena__replace_symbol_body

// Updated cursorAgentTool definition  
mcp__serena__find_symbol -> mcp__serena__replace_symbol_body
```

### 2. Claude Context MCP (Semantic Search)
**Attempted Use:**
- Codebase-wide semantic search for backend references
- Would have enabled natural language queries

**Issue Encountered:**
- OpenAI API key misconfiguration
- Fell back to Serena's pattern search successfully

**Lesson:** Always have fallback tools for critical operations

### 3. Bash Commands (Bulk Operations)
**Use Cases:**
- Batch find/replace across multiple files
- Git operations (mv, add, commit)
- Project building and validation

**Examples:**
```bash
# Efficient batch replacement
find src/tools/workflows -name "*.ts" -exec sed -i 's/"gemini"/"ask-gemini"/g' {} \;

# Proper git file rename
git mv src/tools/cursor-agent.tool.ts src/tools/ask-cursor.tool.ts
```

**Benefits:**
- Fast execution for repetitive operations
- Preserves git history
- Reduces token usage for bulk changes

### 4. TodoWrite Tool (Task Tracking)
**Purpose:**
- Breaking down complex refactoring into steps
- Tracking progress through multi-file changes
- Providing visibility to user

**Task Breakdown:**
1. Search for backend references
2. Update constants
3. Rename files
4. Update workflows
5. Update tests
6. Build validation

**Benefit:** Prevented missing steps in complex refactoring

## Workflow Pattern

### Phase 1: Discovery (Serena)
- Used `search_for_pattern` to find all backend name references
- Identified scope: 24 files across src/, tests/, scripts/

### Phase 2: Precise Edits (Serena)
- Updated core constants with `replace_symbol_body`
- Renamed tool file with git mv
- Updated tool definitions surgically

### Phase 3: Bulk Operations (Bash)
- Batch replaced strings in workflow files
- Batch replaced strings in test files
- Used sed for efficiency across multiple files

### Phase 4: Validation
- TypeScript build to catch errors
- Fixed duplicate "export const" issues
- Confirmed all tests passing

### Phase 5: Documentation (Serena Memories)
- Created 3 comprehensive memories
- Captured refactoring details
- Documented tool validation results

## Key Insights

### When to Use Each Tool
1. **Serena**: Precise code navigation, symbol-level edits, TypeScript/JavaScript
2. **Bash sed**: Bulk string replacements across many files
3. **Git commands**: File operations preserving history
4. **TodoWrite**: Complex multi-step tasks

### Token Efficiency
- **Total tokens used**: ~110k of 200k budget (55%)
- **Efficient by**: Using Serena for targeted reads instead of reading all 24 files
- **Saved**: ~50k tokens by using batch sed instead of individual file edits

### Best Practices Demonstrated
1. Plan before executing (TodoWrite)
2. Use right tool for right job (Serena vs Bash)
3. Validate incrementally (build after changes)
4. Document comprehensively (memories)
5. Always have fallback strategies

## Reusable Pattern

For future large refactorings:
```
1. Use semantic/pattern search to scope the work
2. Create TodoWrite task list
3. Precise edits → Serena
4. Bulk edits → Bash sed/awk
5. File operations → Git commands
6. Validate → TypeScript/tests
7. Document → Memories
```

This approach balances precision, efficiency, and maintainability.