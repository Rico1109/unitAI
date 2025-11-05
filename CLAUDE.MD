# CLAUDE (Compact)

**Created:** 2025-10-29 00:00 UTC
**Last Updated:** 2025-10-31 00:00 UTC
**Version:** 2.5
**Status:** Active
**Supersedes:** None

SSOT: `CLAUDE.md`

---

## 0) PRINCIPLES
- MUST use deterministic rules; avoid prosa.
- DEFAULT TO PARALLEL tool calls unless A→B dependency.
- NEVER create new docs without explicit user approval.
- Prefer UPDATE over CREATE; maintain SSOT.

## 1) SESSION INIT (ALWAYS ON NEW CONVERSATION)
- Run:
  - git log --oneline -5
  - git diff HEAD~3..HEAD --stat
  - git status
  - git branch -vv
- Memory search (always useful):
  - openmemory-search-memories "recent work on darth_feedor"
  - openmemory-search-memories "<YYYY-MM-DD> <topic>" (e.g., "2025-10-29 refactoring")
  - openmemory-search-memories "similar implementation or pattern"
- Outcome: establish recent changes, current branch, relevant memories.

## 3) TOOL AUTO-TRIGGERS & ADVANCED WORKFLOWS

**CLAUDE-CONTEXT: Architectural Navigator & Pattern Finder**
- ALWAYS use repo root: /home/jagger/projects/darth_feedor
- Index: claude-context-index_codebase --path /home/jagger/projects/darth_feedor
- Search: claude-context-search_code "query" --path /home/jagger/projects/darth_feedor
- Queries (semantic, not keyword):
  - "Where is X function called from?" (finds ALL callers)
  - "What code depends on redis_manager?" (maps dependencies)
  - "Find similar implementations of caching logic" (pattern detection)
  - "What modules use BGE embeddings?" (architectural relationships)
  - "Find duplicate error handling patterns" (duplication detection)
- Use BEFORE: feature implementation, bug hunting, refactoring, schema changes
- Why: Hybrid search (BM25 + vectors), finds related code across codebase without reading files
diario anelli
**GEMINI + QWEN: Parallel Code Analysis (Run Both)**
Use for: Complex code, pre-commit review, multi-perspective validation
Strengths:
- Gemini: Architecture patterns, best practices, security/performance, detailed suggestions
- Qwen: Quick pattern recognition, code quality, redundancy detection, bottleneck spotting
- Run both in parallel, compare results for synthesis

Examples:
```
# Parallel analysis
gemini-cli-ask-gemini --prompt "@file.py 1) Architecture review 2) Best practices 3) Security"
## PROJECT: Darth Feedor / Mercury API

Real-time financial market intelligence platform with AI-powered analysis (Gemini/Qwen). Stack: PostgreSQL 17 + pgvector, Redis, FastAPI, Docker + supervisord. Modules: external-ingestion-pipeline, research-papers-pipeline, mercury-api, psql-db (infrastructure), shared (utilities).qwen-cli-ask-qwen --prompt "@file.py 1) Code quality issues 2) Redundant patterns 3) Performance"

# Structured refactoring (Gemini only, use --changeMode)
gemini-cli-ask-gemini --changeMode true --prompt "@file.py Refactor: 1) Readability 2) Performance 3) Error handling"
```

**INTEGRATED WORKFLOWS**

*Feature Implementation:*
1. claude-context: "Where does similar feature exist?" → Find related modules
2. Parallel: Gemini + Qwen analyze existing pattern for best practices
3. Implement changes
4. Parallel: Gemini --changeMode + Qwen review for completeness
5. claude-context: "Find all callers/imports of new function" → Verify impact
6. openmemory-add-memory "Implemented [feature]"

*Bug Hunting:*
1. claude-context: "Where is error message generated?" → Locate root cause
2. claude-context: "All functions calling problematic function" → Call graph
3. Parallel: Gemini + Qwen analyze for logic errors & patterns
4. Fix + verify: claude-context "Find all affected call sites"
5. openmemory-add-memory "Fixed [bug]: [root cause]"

*Refactoring:*
1. claude-context: "Find all functions with pattern X" → Scope
2. claude-context: "Identify code duplication in module Y"
3. Gemini --changeMode: Structured refactoring suggestions
4. Qwen: Edge case & consistency validation
5. claude-context: "Find similar code" → Ensure consistency
6. openmemory-add-memory "Refactored [scope]: [changes]; affects [X] files"

**DeepWiki (GitHub repository documentation):**
- For external repos (FastAPI, Redis, PostgreSQL internals)
- deepwiki-read_wiki_structure "owner/repo"
- deepwiki-ask_question "owner/repo" "question"
- Use: architecture insights on dependencies

**Open-Memory (decisions & changes):**
- Search before answering: "recent work", "<YYYY-MM-DD> <topic>"
- Add after changes: "Implemented X", "Fixed bug: Y", "Directory update: Z"

**Context7 (external library API docs):**
- context7-resolve-library-id "library"
- context7-get-library-docs "/org/project" --topic "topic" --tokens 5000

## 4) FILE SIZE DECISION TREE
- <300 LOC → Read tool ok
- 300–500 LOC → Prefer unified-ai-mcp
- 500–1000 LOC → Claude-context scoped + unified-ai-mcp
- >1000 LOC → Gemini + chunked + semantic search

## 5) MISSING/MOVED FILE RECOVERY
- claude-context-search_code "where is <X> now?" --path /home/jagger/projects/darth_feedor
- Glob: **/<name.ext>, **/<partial>*.<ext>
- Grep: rg -n "<signature>" --glob '!**/node_modules/**'
- Git renames: git log --name-status -n 20 | grep -E "^R" || true
- If large candidate (>200 LOC): Gemini to confirm content
- Update memory: "File moved: <old> -> <new> (reason)"

## 6) DOCUMENTATION GATE (MANDATORY BEFORE NEW .md)
- Pre-search (semantic, root path): 2–3 queries
- Inventory:
  - glob "plans-docs/*.md", "docs/*.md", "**/README*.md"
  - git log -5 --stat | grep "\.md$" || true
  - grep -inE "<topic>|<keyword>" -R plans-docs/ docs/ || true
- Triage:
  - Related doc exists → UPDATE it (no new file)
  - Full rewrite → create successor ONE, deprecate old with banner
  - None exists → CREATE only with explicit user approval
- Metadata required in all docs:
  - Title, Created/Updated, Version, Status, Supersedes
- SSOT: one active doc per topic
- Archive policy: move to archive/ with ARCHIVED_ prefix

## 9) ADVANCED PRE-COMMIT VALIDATION (Multi-Stage)

**Stage 1: Scope Analysis (claude-context)**
- "What code depends on my changes?"
- "Find all files importing modified module"
- "Identify similar implementations that should be consistent"
- Outcome: Impact map, consistency check

**Stage 2: Parallel AI Review (Gemini + Qwen)**
```
# Both in parallel
gemini-cli-ask-gemini --changeMode true --prompt "@modified_file.py Validate: 1) Architecture 2) Error handling 3) Performance 4) Security"
qwen-cli-ask-qwen --prompt "@modified_file.py Check: 1) Code quality issues 2) Redundant logic 3) Potential bugs 4) Edge cases"
```
- Gemini with --changeMode provides structured suggestions
- Qwen catches what Gemini might miss
- Compare outputs, synthesize findings

**Stage 3: Dependency Verification (claude-context)**
- "Find all callers of modified functions"
- "Verify changes compatible with call sites"
- "Find tests related to modified code"

**Stage 4: Memory Update**
- openmemory-add-memory "Refactored [module]: [what changed]; validated with claude-context + Gemini/Qwen; affects [X] files"

## 10) KEY CONFIGS & LOCATIONS
- Root .env: DB, Redis, Telegram, Discord, BLS credentials
- requirements.txt: Root-level consolidated dependencies
- shared/: Install with `pip install -e shared/`
- Gmail OAuth: mercury-api/config/{credentials.json, token.json}
- DB Docker: psql-db/docker-compose.yml
- Plans-docs: research-papers-pipeline/plans-docs/

## 11) AGENT BEHAVIOR SUMMARY
**DO:**
- Check memories & commits at session start
- Use claude-context for architectural queries before any code work
- Run Gemini + Qwen in PARALLEL for complex analysis
- Use claude-context to find ALL affected code (refactoring, bug fixes)
- Run advanced pre-commit validation (claude-context + Gemini + Qwen)
- Update memory after significant changes with architectural impact
- Verify SSOT for docs

**DON'T:**
- Read huge files directly (use Gemini/Qwen)
- Implement without understanding code relationships (use claude-context first)
- Review single-file changes without impact analysis
- Create new docs without approval
- Push to remote unless asked
- Commit secrets
- Use emoji in code/docs

## 12) TOOL QUICK GUIDE
| Tool | When | Purpose | Key Power |
|------|------|---------|-----------|
| Claude-Context | FIRST, before any code work | Architectural navigator | Finds ALL related code; maps dependencies; detects patterns across codebase |
| Gemini | Complex code, pre-commit | Code analysis with depth | Architecture patterns, best practices, structured refactoring (--changeMode) |
| Qwen | Same as Gemini, PARALLEL | Quick perspective | Code quality, redundancy, performance bottlenecks; catches edge cases |
| DeepWiki | External repo internals | GitHub documentation | Architecture insights on dependencies |
| Open-Memory | After significant work | Decision storage | Historical context, date-based queries, architectural decisions |
| Context7 | External library usage | API documentation | FastAPI, Redis, PostgreSQL specifics |

**Workflow Principle**: claude-context FIRST (understand scope) → unified-ai-mcp → claude-context AGAIN (verify impact)

---

**Last Updated**: 2025-10-30 12:00 UTC