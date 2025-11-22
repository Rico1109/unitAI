---
description: Search documentation across multiple sources (local, context7, deepwiki)
argument-hint: <topic> [source: auto|local|context7|deepwiki|all]
allowed-tools: mcp__context7__*, mcp__deepwiki__*, Grep, Glob, Read
---

Search documentation across multiple sources for the specified topic.

**Topic:** $1
**Source:** $2 (defaults to "auto" if not specified)

## Instructions

### Source Selection Logic

**If source is "auto" or not specified:**
- If topic looks like `owner/repo` (contains `/` without spaces): use deepwiki
- If topic matches common libraries (react, node, typescript, nextjs, etc.): use context7 + local
- Otherwise: use local only

**If source is "all":** Search local, context7, and deepwiki in sequence

**If source is specific:** Use only that source

### Search Methods by Source

**Local Documentation:**
1. Use Grep to search for the topic in:
   - `docs/` directory
   - `.claude/docs/` directory
   - `README.md`
   - `*.md` files in project root
2. Report found files with their paths

**Context7 (External Libraries):**
1. Use `mcp__context7__resolve-library-id` with the topic to find the library ID
2. If found, use `mcp__context7__get-library-docs` with:
   - `context7CompatibleLibraryID`: the resolved ID
   - `topic`: the search topic
3. Summarize the relevant documentation found

**DeepWiki (GitHub Repositories):**
1. If topic is `owner/repo` format, use it directly
2. Use `mcp__deepwiki__ask_question` with:
   - `repoName`: the repository
   - `question`: "Documentation and usage for [topic]"
3. Alternatively, use `mcp__deepwiki__read_wiki_structure` to explore available topics

## Output Format

Present results organized by source with:
- Source name as header
- Relevant excerpts or summaries
- Links to full documentation when available

If no results found, suggest:
- Alternative search terms
- Different sources to try
- Direct file paths if local docs might exist elsewhere
