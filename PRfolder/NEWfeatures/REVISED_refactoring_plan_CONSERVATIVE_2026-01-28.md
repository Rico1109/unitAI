# unitAI Smart Workflows - REVISED Conservative Refactoring Plan

**Status**: REVISED - Conservative Approach
**Created**: 2026-01-28 (Revised after actual workflow analysis)
**Key Insight**: Workflows are well-differentiated; **DO NOT consolidate**

---

## Executive Summary

**Analysis Conclusion** (by Gemini after reading actual implementations):
> "The unitAI workflows are well-differentiated, each serving a distinct purpose in the development lifecycle. The current modular 'toolbox' approach is effective, and **merging workflows is not recommended** as it would likely create a monolithic, less user-friendly tool."

**Revised Strategy**:
- ✅ **KEEP** all existing specialized workflows (10 workflows)
- ✅ **ADD** new capabilities (Overthinker, Implementor enhancements, Explorer)
- ✅ **ENHANCE** existing workflows with new features
- ✅ **CONVERT** some to skills/plugins where appropriate
- ❌ **DO NOT** eliminate or merge workflows

---

## Current Workflow Analysis (From Actual Code)

### Validation Category (4 workflows - ALL DISTINCT)

| Workflow | Specialization | Stage | Keep/Enhance |
|----------|----------------|-------|--------------|
| **parallel-review** | General code quality, multiple AI perspectives | Any files | ✅ **KEEP** - Foundation review tool |
| **pre-commit-validate** | Staged git changes, 3 parallel checks (secrets/quality/breaking) | Pre-commit hook | ✅ **KEEP** + Convert to Plugin |
| **validate-last-commit** | Specific commit audit with metadata | Post-commit | ✅ **KEEP** + Convert to Skill |
| **triangulated-review** | High-confidence 3-way check (Gemini+Cursor+Droid) | Critical code | ✅ **KEEP** - Unique orchestration |

**Verdict**: These are NOT redundant - they operate at different git stages and serve different confidence levels.

---

### Implementation Category (2 workflows - DISTINCT)

| Workflow | Specialization | Scope | Keep/Enhance |
|----------|----------------|-------|--------------|
| **refactor-sprint** | Complex refactoring with 3-phase plan (Cursor→Gemini→Droid) | Large-scale restructuring | ✅ **KEEP** - Unique for refactoring |
| **auto-remediation** | Quick operational plan from Droid | Known issues | ✅ **KEEP** - Simple & direct |

**Verdict**: refactor-sprint targets complex refactors, auto-remediation is a lightweight Droid interface. Both useful.

---

### Planning Category (2 workflows - DISTINCT)

| Workflow | Specialization | Purpose | Keep/Enhance |
|----------|----------------|---------|--------------|
| **feature-design** | Full lifecycle orchestrator (Architect→Implementer→Tester) | New features | ✅ **KEEP** + Enhance |
| **bug-hunt** | Investigative workflow starting from symptoms | Unknown bugs | ✅ **KEEP** - Unique investigation |

**Verdict**: feature-design is a meta-workflow for full feature development, bug-hunt is symptom-driven investigation. Very different.

---

### Exploration Category (1 workflow)

| Workflow | Specialization | Purpose | Keep/Enhance |
|----------|----------------|---------|--------------|
| **init-session** | Context gathering at session start | Session bootstrap | ✅ **ENHANCE** with Serena detection |

**Verdict**: Unique purpose - no other workflow does this.

---

## Revised Refactoring Strategy

### Phase 1: Enhancement (NOT Elimination)

#### 1.1 Enhance Existing Workflows

**init-session** (High Priority)
- ✅ Add Serena folder detection (`.serena/`)
- ✅ Fallback to `docs/` with `ls -lt`
- ✅ Suggest Serena installation if not found
- ✅ SSOT structure guidance
- ✅ Offer to run new Explorer workflow

**feature-design** (Medium Priority)
- ✅ Integrate with new Overthinker for better planning
- ✅ Add TDD support (generate tests section)
- ✅ Enhanced validation step

**refactor-sprint** (Medium Priority)
- ✅ Add CCS delegation support for simple tasks
- ✅ Model selection configurability
- ✅ Rollback mechanism

---

#### 1.2 Add/Enhance Workflows

**overthinker** (Existing Prototype -> Enhanced)
- Purpose: Multi-agent iterative planning with TDD
- Distinct from feature-design: Pure planning phase, no implementation
- Features:
  - 3-5 agent loop refinement
  - TDD integration (tests section)
  - SQLite storage (`.unitai/unitai.db`)
  - Structured output (JSON/YAML)
- Integration: feature-design can invoke Overthinker for planning phase

**explorer** (New)
- Purpose: Codebase mapping and documentation drift detection
- Distinct from init-session: Deep analysis vs quick context
- Features:
  - Phase 1: Lightweight scan (structure.md generation)
  - Phase 2: Intelligent proposals (drift detection, refactoring suggestions)
  - Can trigger Overthinker for refactoring plans

**implementor-enhanced** (New)
- Purpose: Execute structured plans with CCS delegation
- Not a replacement: A new capability for plan execution
- Features:
  - Parse plans from Overthinker
  - CCS delegation for simple tasks
  - Model selection (GLM/Haiku/Opus)
  - Staging + rollback
- Integration: Complements existing workflows, doesn't replace them

---

### Phase 2: Skills & Plugins Conversion

#### Convert to Skills (On-Demand Utilities)

| Workflow | Convert to Skill | Command | Reasoning |
|----------|-----------------|---------|-----------|
| validate-last-commit | ✅ YES | `/validate-commit [ref]` | Utility for checking specific commits |
| auto-remediation | ✅ YES | `/remediate [symptoms]` | Simple Droid interface |

**Benefits**: Lighter weight, easier to invoke for quick tasks

#### Convert to Plugins (Automated Hooks)

| Workflow | Convert to Plugin | Trigger | Reasoning |
|----------|------------------|---------|-----------|
| pre-commit-validate | ✅ YES | Git pre-commit hook | Perfect for automation |

**Benefits**: Automatic validation, zero manual effort

#### Keep as Workflows (Complex Orchestration)

All others remain workflows because they:
- Orchestrate multiple AI backends
- Have complex multi-phase logic
- Require user decision points
- Produce comprehensive reports

---

### Phase 3: Interactive Menus & Token Efficiency

#### 3.1 Add AskUserQuestion Menus

**For ALL workflows** (not just new ones):

1. **Model Selection Menu**
   ```
   Which model should execute this workflow?
   ○ gemini-3-flash (Fastest)
   ● gemini-3-pro (Recommended)
   ○ opus (Most Powerful)
   ```

2. **Validation Depth Menu** (for validation workflows)
   ```
   Select validation level:
   ○ Quick (5-10s): Basic checks
   ● Thorough (20-30s): Comprehensive
   ○ Paranoid (60-90s): Maximum confidence
   ```

3. **Backend Override Menu**
   ```
   Use default backends or customize?
   ● Auto-select (Recommended)
   ○ Let me choose backends
   ```

---

#### 3.2 Token Efficiency Enhancements

**For ALL workflows that read TS/JS files**:
- ✅ Integrate Serena LSP (get_symbols_overview instead of full reads)
- ✅ Expected savings: 90-97.5% on large files

**For context gathering** (init-session, bug-hunt):
- ✅ Use CCS delegation for reading multiple files
- ✅ Expected savings: 85-90%

**For evaluation**:
- ✅ Never read files to grade workflow outputs
- ✅ Delegate evaluation to external agents
- ✅ Expected savings: 87%

---

### Phase 4: Parallel Dispatch Architecture

**Purpose**: Enable parallel execution of independent tasks within workflows

**Target Workflows**:
- parallel-review: Already parallel, can be optimized
- feature-design: Parallel agent execution (Architect || Implementer || Tester)
- bug-hunt: Parallel investigation phases
- New implementor: Parallel task execution

**Components**:
- Plan decomposer (break tasks into dependency graph)
- Conflict detector (file write conflicts)
- Coordinator (dispatch & collect results)
- Rollback mechanism

**Expected Speedup**: 3-4x on multi-task workflows

---

## Revised Workflow Inventory (After Refactoring)

### Existing Workflows (10 - ALL KEPT)

1. ✅ **parallel-review** - General code review
2. ✅ **pre-commit-validate** - Staged changes validation (+ Plugin version)
3. ✅ **validate-last-commit** - Commit audit (+ Skill version)
4. ✅ **triangulated-review** - High-confidence 3-way review
5. ✅ **init-session** - Session context (ENHANCED)
6. ✅ **feature-design** - Full feature lifecycle (ENHANCED)
7. ✅ **bug-hunt** - Symptom-driven investigation
8. ✅ **auto-remediation** - Quick Droid plans (+ Skill version)
9. ✅ **refactor-sprint** - Complex refactoring (ENHANCED)

### New Workflows (2) & Enhanced Prototypes (1)

10. ✅ **overthinker** - Iterative planning with TDD (Prototype exists)
11. 🆕 **explorer** - Codebase mapping & drift detection
12. 🆕 **implementor** - Structured plan execution

### Skills (3)

- `/validate-commit [ref]` - Check specific commit
- `/remediate [symptoms]` - Quick Droid plan
- `/overthink [prompt]` - Trigger planning workflow

### Plugins (1)

- Pre-commit validation hook

---

## Implementation Roadmap (Revised)

### Phase 1: Q1 2026 (Enhancements)

**Week 1-2: init-session Enhancement**
- Serena detection
- SSOT guidance
- Explorer integration

**Week 3-4: Token Efficiency**
- Integrate Serena LSP in all workflows
- Add CCS delegation support
- Measure baseline vs optimized

**Week 5-6: Interactive Menus**
- Model selection menus
- Validation depth menus
- Backend override menus

**Deliverable**: Enhanced existing workflows, 60-70% token savings

---

### Phase 2: Q2 2026 (New Capabilities)

**Week 1-3: Overthinker Workflow (Enhancement)**
- Multi-agent loop
- TDD integration
- SQLite storage
- Structured plan output

**Week 4-6: Explorer Workflow**
- Phase 1: Lightweight scan
- Phase 2: Intelligent proposals
- Drift detection
- structure.md generation

**Week 7-8: Implementor Workflow**
- Plan parser
- CCS delegation
- Model selection
- Rollback mechanism

**Week 9: Skills & Plugins**
- Convert validate-commit to skill
- Convert pre-commit-validate to plugin
- NPX packaging

**Deliverable**: 3 new workflows, skills system, plugin system

---

### Phase 3: Q3 2026 (Optimization)

**Week 1-4: Parallel Dispatch**
- Dependency graph builder
- Conflict detector
- Task coordinator
- Progress tracking + rollback

**Week 5-8: Integration & Testing**
- feature-design + Overthinker integration
- Overthinker + Implementor chain
- Explorer + Overthinker trigger
- Comprehensive test suite

**Deliverable**: Parallel execution, full integration, 3-4x speedup

---

## Success Metrics (Revised)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Workflow count | 9 | 12 (9 + 3 new) | +33% capabilities |
| Skills added | 0 | 3 | New capability |
| Plugins added | 0 | 1 | Automation |
| Token per task | 20-25k | 5-7k | -75% |
| File read (TS/JS) | 8k | 200 | -97.5% |
| Parallel speedup | 1x | 3-4x | +300% |
| User satisfaction | Baseline | Maintain or improve | Critical |

---

## What Changed from Original Plan?

### ❌ Original (Too Aggressive)
- Consolidate 9 → 5 workflows
- Merge 4 validation workflows into 1 "Verificator"
- Merge 2 implementation workflows into 1 "Implementor"
- Deprecate feature-design, bug-hunt, auto-remediation

### ✅ Revised (Conservative)
- **Keep** all 9 workflows (each is specialized)
- **Add** 3 new workflows (Overthinker, Explorer, Implementor)
- **Enhance** existing workflows with new features
- **Convert** 2 to skills, 1 to plugin (not eliminate)
- **Integrate** new capabilities with existing toolbox

---

## Key Principles

1. **Modular Toolbox > Monolithic System**
   - Each workflow serves a distinct purpose
   - Users choose the right tool for the job
   - Don't force consolidation

2. **Enhance, Don't Replace**
   - Add capabilities, don't remove them
   - Integrate new features with existing workflows
   - Maintain backward compatibility

3. **Skills for Simplicity, Workflows for Orchestration**
   - Simple tasks → Skills (on-demand)
   - Complex orchestration → Workflows
   - Automation → Plugins

4. **Token Efficiency Without Sacrifice**
   - Apply Serena LSP to ALL workflows
   - Use CCS delegation where appropriate
   - Never compromise functionality for token savings

---

## Risks Mitigated

| Risk (Original Plan) | Mitigation (Revised Plan) |
|---------------------|---------------------------|
| Loss of specialized functionality | All workflows kept |
| User confusion from eliminations | Only conversions (skill/plugin) |
| Breaking changes | Purely additive changes |
| Monolithic complexity | Maintain modular toolbox |
| Feature regression | No features removed |

---

## Next Steps

1. **Approval**: Review this conservative plan with team
2. **Phase 1 Start**: Begin with enhancements (init-session, token efficiency, menus)
3. **Measure**: Baseline token usage on current workflows
4. **Iterate**: Build new capabilities (Overthinker, Explorer, Implementor)
5. **Integrate**: Connect new workflows with existing toolbox
6. **Optimize**: Add parallel dispatch for speedup

---

**Status**: Ready for implementation
**Philosophy**: Enhance the toolbox, don't consolidate it
**Expected Outcome**: More capabilities, better efficiency, happier users
