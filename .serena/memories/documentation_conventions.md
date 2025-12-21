# Documentation Conventions

**Created**: 2025-11-28  
**Modified**: 2025-11-28  
**Purpose**: Define standards for project documentation to reduce clutter and maintain chronological clarity

## Core Principles

### 1. Documentation Minimalism
**Default behavior: DO NOT create documentation files unless one of these conditions is met:**

- ✅ User explicitly requests documentation
- ✅ Creating permanent reference material (API docs, architecture diagrams, user guides)
- ✅ Recording design decisions with long-term architectural impact
- ❌ Investigation summaries (use Serena memory instead)
- ❌ Task completion reports (use git commits instead)
- ❌ One-off analysis results (use Serena memory instead)

### 2. Preferred Alternatives to Documentation

**Use these instead of creating .md files:**

1. **Git Commits**: For implementation work, bug fixes, and feature completions
   - Capture what changed, why, and technical details in commit messages
   - Reference related issues/tickets
   - Example: `feat: integrate NY Fed API for RRP data to replace stale FRED data (fixes #123)`

2. **Serena Memory**: For project knowledge, patterns, and learnings
   - Technical decisions and rationale
   - Component behaviors and quirks
   - Investigation findings (e.g., "FRED API has T-2 lag, NY Fed is T+1")
   - Gotchas and workarounds
   - Example memory: `fed_data_source_analysis` instead of `INVESTIGATION_FRED_VS_NYFED.md`

3. **Code Comments**: For inline context and non-obvious logic
   - Why a particular approach was taken
   - Known limitations or edge cases
   - Example: `# NY Fed API returns values in ones (dollars), not millions`

### 3. When Documentation IS Warranted

Create documentation files ONLY for:

- **User Guides**: End-user instructions, setup guides, deployment procedures
- **API Reference**: Public interfaces, endpoints, contracts
- **Architecture Decisions Records (ADRs)**: Major architectural choices with long-term impact
- **Component Documentation**: Permanent reference for complex subsystems
- **Explicitly Requested**: User says "create documentation for X"

### 4. Required Metadata Format

**All documentation files MUST include this frontmatter:**

```markdown
---
created: YYYY-MM-DD
modified: YYYY-MM-DD
purpose: <one-line description>
status: [draft|active|deprecated|archived]
type: [guide|reference|adr|component-doc]
related_memories: [memory_name1, memory_name2]
---

# Document Title
```

**Field Definitions:**
- `created`: Date file was first created
- `modified`: Date of last significant update
- `purpose`: One-line summary of document's purpose
- `status`: Current lifecycle state
  - `draft`: Work in progress
  - `active`: Current and maintained
  - `deprecated`: Outdated but kept for reference
  - `archived`: Moved to archive, historical only
- `type`: Document category for organization
- `related_memories`: Links to relevant Serena memories for cross-reference

### 5. Naming Conventions

**Use descriptive, date-stamped names for temporal documents:**

- ❌ `INVESTIGATION_SUMMARY.md` (generic, loses context)
- ❌ `INVESTIGATION_COMPLETE.md` (redundant with git history)
- ✅ Serena memory: `fed_liquidity_discrepancy_analysis`
- ✅ Git commit: `fix: resolve FRED vs NY Fed data staleness issue`

**For permanent documentation:**
- Use lowercase with hyphens: `api-reference.md`, `deployment-guide.md`
- Component docs: `components/fed-liquidity.md`, `components/nyfed-operations.md`
- ADRs: `adr/001-use-nyfed-api-for-rrp.md` (numbered for chronology)

### 6. Investigation Results → Serena Memory Pattern

**Instead of creating `INVESTIGATION_*.md`, follow this pattern:**

1. **During investigation**: Use comments in code or temporary notes
2. **Upon completion**: Create Serena memory with findings
3. **If code changed**: Commit with detailed message
4. **Result**: No orphaned investigation files cluttering the repo

**Example Flow:**
```
Investigation: "Why is fed_liquidity.py showing stale data?"

❌ OLD WAY:
- Create INVESTIGATION_FED_LIQUIDITY_STALENESS.md
- Write findings in markdown
- File gets forgotten and becomes stale

✅ NEW WAY:
- Investigate using Serena tools
- Create memory: fed_data_source_analysis
  Content: "FRED API has T-2 lag, NY Fed is T+1. Switched RRP to NY Fed API. See commit abc123."
- Commit with message: "fix: replace FRED RRP with NY Fed API due to T-2 publication lag"
- Result: Knowledge captured in searchable memory, changes tracked in git
```

### 7. Documentation Lifecycle

**Regular maintenance:**
- Quarterly review of `/docs` directory
- Archive or delete outdated investigation files
- Update `modified` date when making significant changes
- Move deprecated docs to `/docs/archive/YYYY/`

### 8. Documentation Decision Tree

```
Need to capture information?
│
├─ Is it implementation work?
│  └─ YES → Use git commit with detailed message
│
├─ Is it project knowledge/learning?
│  └─ YES → Use Serena memory
│
├─ Is it permanent reference material?
│  └─ YES → Create documentation with metadata
│
└─ Is it temporary analysis/investigation?
   └─ Use Serena memory, NOT a doc file
```

## Examples

### ✅ Good: Using Serena Memory
```
Memory: nyfed_api_unit_conversion_gotcha
Content: "NY Fed API returns RRP values in ones (dollars), not millions. 
Must convert to billions: value / 1_000_000_000. FRED returns in billions already.
See fed/fed_liquidity.py:124"
```

### ✅ Good: Using Git Commit
```
git commit -m "fix: correct NY Fed RRP unit conversion from dollars to billions

NY Fed API returns values in ones (dollars), not millions as initially assumed.
This caused RRP Balance to show $2,217,000B instead of $2.22B.

Changed conversion from (rrp_by_date / 1000) to (rrp_by_date / 1_000_000_000)

Affected file: fed/fed_liquidity.py:124
Test verification: outputs/pipeline_raw-2025-11-28_08-28-29.md"
```

### ✅ Good: Warranted Documentation
```markdown
---
created: 2025-11-28
modified: 2025-11-28
purpose: NY Fed API integration guide for liquidity monitoring
status: active
type: component-doc
related_memories: [fed_liquidity_component, nyfed_operations_component]
---

# NY Fed Markets API Integration

## Overview
Direct integration with NY Fed Markets API for real-time repo operations data...
```

### ❌ Bad: Unnecessary Investigation Doc
```markdown
# INVESTIGATION SUMMARY - FED LIQUIDITY DISCREPANCIES

Date: 2025-11-28
Investigation: Comparing FRED vs NY Fed data...
Findings: FRED has lag...
Recommendations: Switch to NY Fed...

❌ This should be a Serena memory + git commit instead
```

## Migration Strategy

**For existing investigation/summary docs:**
1. Extract key findings into Serena memories
2. Cross-reference with related git commits
3. Move to `/docs/archive/2025/` or delete if redundant
4. Update any references in other docs

**Preservation criteria:**
- Keep if contains unique architectural decisions
- Keep if referenced by active documentation
- Keep if user explicitly created it
- Archive everything else
