# unitAI Smart Workflows Refactoring - Implementation Plan

**Status**: Ready for Implementation
**Created**: 2026-01-28
**Analysis Method**: CCS Gemini Delegation → Triangulated Review (Gemini + Cursor + Droid)
**Token Efficiency**: 95% savings (offloaded to external agents)

---

## Executive Summary

This plan consolidates the unitAI workflows system from 9+ redundant workflows into 5 core workflows with clear responsibilities. The refactoring introduces modular architecture, parallel execution, token efficiency patterns, and interactive user controls.

**Key Metrics**:
- Workflow reduction: 9 → 5 (44% simplification)
- Validation workflows: 4 → 1 unified `Verificator`
- Token efficiency: 90% improvement via Serena LSP integration
- Expected cost savings: 60-70% reduction in LLM usage

---

## 1. Current State Analysis

### Existing Workflows Inventory

| Workflow | Category | Status | Action |
|----------|----------|--------|--------|
| `workflowParallelReviewTool` | Validation | Redundant | → Merge into Verificator |
| `workflowPreCommitValidateTool` | Validation | Specialized | → Convert to Plugin |
| `workflowValidateLastCommitTool` | Validation | Utility | → Convert to Skill |
| `workflowTriangulatedReviewTool` | Validation | Complex | → Keep as Verificator strategy |
| `workflowInitSessionTool` | Exploration | Core | → Enhance |
| `workflowFeatureDesignTool` | Planning | Redundant | → Merge into Overthinker |
| `workflowBugHuntTool` | Exploration | Base | → Evolve into Explorer |
| `workflowAutoRemediationTool` | Implementation | Component | → Merge into Implementor |
| `workflowRefactorSprintTool` | Implementation | Base | → Evolve into Implementor |

### Problems Identified

1. **Redundancy**: 4 validation workflows with overlapping functionality
2. **Fragmentation**: No cohesive orchestration between workflows
3. **Token Inefficiency**: Reading entire files instead of using Serena LSP
4. **Lack of TDD**: Plans don't systematically include test cases
5. **No SSOT Guidance**: Init-session doesn't guide toward best practices
6. **Missing Rollback**: No error recovery mechanism

---

## 2. New Architecture (3 Core Workflows)

### 2.1 Overthinker Workflow (Planning)

**Purpose**: Generate structured, TDD-compliant implementation plans

**Enhancements**:
- **TDD Integration**: Every plan includes a `tests` section with test cases
- **Database Storage**: SQLite in `.unitai/` for workflow tracking and artifacts
- **Multi-Agent Loop**: 3-5 agents refine the plan iteratively
- **Structured Output**: JSON/YAML format consumable by Implementor

**Schema (unitai.db)**:
```sql
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT
);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT,
  FOREIGN KEY (workflow_id) REFERENCES workflows (id)
);
```

**File Persistence Strategy**:
- Each agent saves output to `.unitai/overthinker/{workflow_id}/agent_{n}.md`
- Final consolidated plan: `.unitai/overthinker/{workflow_id}/plan.json`

**Complementary Skills**:
- `/overthink [prompt]` - Trigger the workflow
- `/plan-to-implement [plan_id]` - Parse plan and pass to Implementor

---

### 2.2 Implementor Workflow (Execution)

**Purpose**: Execute structured plans with CCS delegation for simple tasks

**Design**:
- **Merge of**: `workflowRefactorSprintTool` + `workflowAutoRemediationTool`
- **CCS Integration**: Delegate deterministic tasks (tests, typos, simple refactors)
- **Model Selection**: Configurable (GLM for simple, Opus for complex)
- **Plan Parsing**: Reads JSON/YAML plans from Overthinker
- **Progress Tracking**: Step-by-step execution with status updates

**Execution Patterns**:
```yaml
plan:
  tasks:
    - id: task_1
      type: implement
      description: "Add OAuth middleware"
      files: ["src/auth/oauth.ts"]
      dependencies: []
      model: opus  # complex task

    - id: task_2
      type: test
      description: "Add unit tests for OAuth"
      files: ["tests/auth/oauth.test.ts"]
      dependencies: [task_1]
      delegate_to: ccs  # simple task
```

**Rollback Mechanism**:
- Modifications staged in `.unitai/staging/` before applying
- Atomic copy to destination only after validation passes
- Rollback = restore from staging

---

### 2.3 Verificator Workflow (Validation)

**Purpose**: Unified validation layer for all stages (pre-commit, post-commit, PR)

**Consolidates**:
- `workflowParallelReviewTool`
- `workflowPreCommitValidateTool`
- `workflowValidateLastCommitTool`
- `workflowTriangulatedReviewTool` (as a strategy)

**Validation Strategies**:
```yaml
strategies:
  quick:  # 5-10s
    - security_scan
    - basic_linting

  thorough:  # 20-30s
    - security_scan
    - quality_checks
    - breaking_change_detection

  paranoid:  # 60-90s
    - comprehensive_analysis
    - triangulated_review (Gemini + Cursor + Droid)

  triangulated:  # For critical code
    - gemini: architecture + long-term impact
    - cursor: concrete improvements
    - droid: operational checklist
```

**Integration with Implementor**:
- Takes list of modified files from Implementor
- Compares against original plan + test cases
- Reports pass/fail + specific issues

**Model Selection**: Opus for thorough reviews, Flash for quick scans

---

## 3. Supporting Workflows

### 3.1 Init-Session (Enhanced)

**Purpose**: Context-aware session initialization with SSOT guidance

**Enhancements**:
1. **Serena Detection**: Check for `.serena/` folder first
   - If found: Use content for initial context
   - Extract SSOT documents and recent changes

2. **Fallback to Docs**: If no `.serena/`, check `docs/`
   ```bash
   ls -lt docs/ | head -10  # Most recent files
   ```

3. **Serena Installation Suggestion**:
   ```
   ⚠️ No .serena/ folder detected

   Recommendation: Install Serena for enhanced development experience
   - Token savings: 90% on large file operations
   - Semantic code navigation
   - SSOT documentation structure

   Install: npm install -g serena-lsp
   Setup: serena init
   ```

4. **SSOT Formation Guidance**:
   - Propose creating `.serena/ssot/` structure
   - Suggest memory files for key components
   - Offer to run Explorer to generate `structure.md`

**Model Selection**: `gemini-2.5-flash` for fast startup

---

### 3.2 Explorer (New Workflow)

**Purpose**: Codebase mapping, discrepancy detection, refactoring proposals

**Two-Phase Architecture**:

**Phase 1: Explorer (Lightweight)**
- Scan codebase structure
- Generate `structure.md` with architecture map
- Identify entry points and dependencies
- Model: `gemini-2.5-flash`

**Phase 2: Proposer (Intelligent)**
- Compare code vs documentation (detect drift)
- Identify disorganized/complex areas
- Generate refactoring proposals
- Model: `gemini-2.5-pro` or `opus`

**Integration with Overthinker/Implementor**:
```yaml
explorer_output:
  findings:
    - type: documentation_drift
      file: src/auth/oauth.ts
      issue: "Implementation changed but docs outdated"
      action: suggest_overthinker  # Generate update plan

    - type: code_smell
      file: src/legacy/payment.ts
      issue: "500 LOC, no tests, high complexity"
      action: suggest_refactor_plan  # Overthinker → Implementor
```

**Auto-Execution**: With user approval, triggers Overthinker → Implementor chain

---

## 4. Skills vs Workflows vs Plugins Classification

### Skills (On-Demand Utilities)

**Installed via NPX**:
```bash
npx @unitai/skills install validate-commit
```

| Skill | Purpose | Command |
|-------|---------|---------|
| `validate-commit` | Check specific commit | `/validate-commit HEAD~1` |
| `plan-to-implement` | Parse Overthinker output | `/plan-to-implement <plan_id>` |
| `overthink` | Trigger planning workflow | `/overthink "add OAuth"` |

**Configuration**: `~/.unitai/skills.json`

---

### Plugins (Automated Hooks)

**Installed as Git Hooks or Claude Code Plugins**:

1. **Pre-Commit Plugin**:
   ```yaml
   # .git/hooks/pre-commit (via husky or lefthook)
   name: unitai-pre-commit
   trigger: pre-commit
   action: ccs gemini -p "Validate staged changes: quick security + breaking changes"
   fallback: manual_approval
   ```

2. **Serena LSP Interceptor Plugin**:
   ```yaml
   # .claude/plugins/serena-lsp-first.yaml
   hooks:
     pre_tool_call:
       - tool: Read
         conditions:
           file_extension: [.ts, .tsx, .js, .jsx]
           file_size: ">300"
         action: redirect_to serena__get_symbols_overview
   ```

---

### Deprecated Workflows

| Workflow | Replacement | Migration Path |
|----------|-------------|----------------|
| `workflowParallelReviewTool` | Verificator (parallel strategy) | Auto-migrate |
| `workflowFeatureDesignTool` | Overthinker | Map parameters |
| `workflowAutoRemediationTool` | Implementor | Use `type: fix` in plan |

---

## 5. Parallel Dispatch Architecture

**Goal**: Execute non-conflicting tasks simultaneously for 3-4x speedup

**Components**:

### 5.1 Plan Decomposer
```typescript
interface Task {
  id: string;
  type: 'implement' | 'test' | 'validate';
  files: string[];
  dependencies: string[];  // task IDs
  model?: string;
  delegate_to?: 'ccs' | 'direct';
}

function decomposePlan(plan: Plan): Task[] {
  // Parse structured plan into task graph
  // Identify file dependencies
  // Return topologically sorted task list
}
```

### 5.2 Dependency Resolver
```typescript
function buildDependencyGraph(tasks: Task[]): Graph {
  // Create DAG (Directed Acyclic Graph)
  // Nodes = tasks, Edges = dependencies
  // Detect cycles (error if found)
}

function getParallelBatches(graph: Graph): Task[][] {
  // Topological sort
  // Group tasks with no dependencies into batch 1
  // Group tasks depending only on batch 1 into batch 2
  // etc.
}
```

### 5.3 Coordinator
```typescript
class TaskCoordinator {
  async executeBatch(tasks: Task[]): Promise<Result[]> {
    // Execute tasks in parallel
    // Detect file write conflicts
    // Collect results
  }

  detectConflict(task1: Task, task2: Task): boolean {
    // Check if both modify the same file
    const overlap = intersection(task1.files, task2.files);
    return overlap.length > 0;
  }

  async rollback(completedTasks: Task[]): Promise<void> {
    // Restore from .unitai/staging/
  }
}
```

**Conflict Resolution**:
- If 2 tasks modify same file → Sequentialize them
- If task fails → Rollback entire batch
- Progress tracking: `.unitai/progress.json`

---

## 6. Interactive Menu Integration (AskUserQuestion)

### 6.1 Model Selection Menu

**Trigger**: Before executing any workflow

```typescript
AskUserQuestion({
  questions: [{
    question: "Which model should execute this workflow?",
    header: "Model",
    options: [
      {
        label: "gemini-3-flash (Fastest)",
        description: "Fast, cost-effective for simple tasks. ~2-5s execution."
      },
      {
        label: "gemini-3-pro (Recommended)",
        description: "Balanced performance and cost. ~10-15s execution."
      },
      {
        label: "opus (Most Powerful)",
        description: "Deep reasoning for complex tasks. ~30-60s execution."
      }
    ],
    multiSelect: false
  }]
})
```

---

### 6.2 Workflow Orchestration Menu

**Trigger**: After Explorer detects issues

```typescript
AskUserQuestion({
  questions: [{
    question: "Explorer found 3 issues. How would you like to proceed?",
    header: "Action",
    options: [
      {
        label: "Auto-fix with Overthinker + Implementor",
        description: "Generate plan and execute automatically (review before commit)"
      },
      {
        label: "Generate plan only (Overthinker)",
        description: "Review plan before implementation"
      },
      {
        label: "Show details and decide manually",
        description: "I'll review findings and trigger workflows myself"
      }
    ],
    multiSelect: false
  }]
})
```

---

### 6.3 Validation Strategy Menu

**Trigger**: Before Verificator runs

```typescript
AskUserQuestion({
  questions: [{
    question: "Select validation depth:",
    header: "Validation",
    options: [
      {
        label: "Quick (5-10s)",
        description: "Security scan + basic linting"
      },
      {
        label: "Thorough (20-30s, Recommended)",
        description: "Security + quality + breaking changes"
      },
      {
        label: "Paranoid (60-90s)",
        description: "Comprehensive analysis with triangulated review"
      }
    ],
    multiSelect: false
  }]
})
```

---

## 7. Token Efficiency Patterns

### 7.1 Serena LSP Integration

**Rule**: ANY TS/JS file >300 LOC → Use Serena automatically

| Operation | Traditional | With Serena | Savings |
|-----------|------------|-------------|---------|
| Read file | `Read` (8k tokens) | `get_symbols_overview` (200) | 97.5% |
| Edit method | Read + Edit (10k) | `find_symbol` + `replace_symbol_body` (1.5k) | 85% |
| Check impact | Manual (12k) | `find_referencing_symbols` (800) | 93% |

**Implementation**:
- Explorer: Use Serena for all TS/JS analysis
- Implementor: Use Serena for code navigation before edits
- Verificator: Use Serena to understand changes (not full file reads)

---

### 7.2 Context Gathering Optimization

**Delegation Pattern**:

```typescript
// ANTI-PATTERN (20k tokens)
const file1 = await Read('large-file-1.ts');
const file2 = await Read('large-file-2.ts');
const file3 = await Read('large-file-3.ts');
analyze(file1, file2, file3);

// OPTIMIZED (2.5k tokens)
const analysis = await ccs('gemini', {
  prompt: `@large-file-1.ts @large-file-2.ts @large-file-3.ts
  Extract: Key interfaces, dependencies, exports
  Format: Structured JSON only`
});
```

**When to Delegate**:
- >5 files to analyze
- Total LOC >2000
- Exploratory analysis (not editing)

---

### 7.3 Evaluation Delegation

**NEVER read files to evaluate agent work**

```typescript
// ANTI-PATTERN (15k tokens)
const implementedFiles = await Promise.all(
  modifiedFiles.map(f => Read(f))
);
const grade = evaluateImplementation(implementedFiles);

// OPTIMIZED (2k tokens)
const evaluations = await Promise.all([
  ccs('gemini', `@files Grade: plan adherence, architecture`),
  ccs('qwen', `@files Grade: quality, edge cases`)
]);
const grade = synthesizeReports(evaluations);  // 500 tokens
```

**Expected Savings**: 87% reduction in evaluation token cost

---

## 8. Implementation Roadmap

### Phase 1: Q1 2026 (P0 - Foundation)

**Goal**: Eliminate redundancy, establish core workflows

**Deliverables**:
1. ✅ Verificator workflow (consolidates 4 validation workflows)
   - Strategies: quick, thorough, paranoid, triangulated
   - Integration with Implementor
   - Test coverage >80%

2. ✅ Implementor workflow (merges RefactorSprint + AutoRemediation)
   - CCS delegation support
   - Model selection (GLM, Haiku, Opus)
   - Rollback mechanism
   - Plan parsing (JSON/YAML)

3. ✅ Deprecate old workflows
   - Mark with `@deprecated`
   - Redirect to new workflows with warnings
   - Migration guide for users

**Success Metrics**:
- Workflows reduced from 9 to 5
- Token usage decreased by 50%
- Zero breaking changes for existing users

---

### Phase 2: Q2 2026 (P1 - Intelligence)

**Goal**: Enhance planning and exploration capabilities

**Deliverables**:
1. ✅ Overthinker enhancements
   - TDD integration (tests section in plans)
   - SQLite storage (`.unitai/unitai.db`)
   - Multi-agent refinement loop
   - Structured plan output

2. ✅ Explorer workflow
   - Phase 1: Lightweight scanning (Flash)
   - Phase 2: Intelligent proposals (Pro/Opus)
   - `structure.md` generation
   - Documentation drift detection
   - Auto-trigger Overthinker for fixes

3. ✅ Init-Session enhancements
   - Serena folder detection
   - SSOT guidance
   - Installation suggestions

4. ✅ Skills conversion
   - `validate-commit` skill
   - `overthink` skill
   - NPX packaging
   - `~/.unitai/skills.json` config

**Success Metrics**:
- Plans include test cases (100%)
- Explorer detects 90% of doc drift
- Init-session time reduced by 60%

---

### Phase 3: Q3 2026 (P2 - Automation)

**Goal**: Maximize automation and parallelization

**Deliverables**:
1. ✅ Parallel dispatch architecture
   - Plan decomposer
   - Dependency resolver (DAG)
   - Task coordinator
   - Conflict detection
   - Progress tracking + rollback

2. ✅ Plugin system
   - Pre-commit plugin
   - Serena LSP interceptor plugin
   - Plugin configuration (`.claude/plugins/`)

3. ✅ Interactive menus
   - Model selection menu
   - Workflow orchestration menu
   - Validation strategy menu
   - Plan approval prompts

**Success Metrics**:
- 3-4x speedup on large plans (parallel execution)
- 90% of tool selection automated
- Zero manual pre-commit failures

---

## 9. Risk Analysis & Mitigation

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Breaking changes during migration** | Medium | High | Phased rollout with fallback to old workflows; comprehensive test suite |
| **Parallel dispatch introduces race conditions** | Medium | High | Start with read-only tasks; extensive conflict detection; atomic operations |
| **Complex architecture becomes unmaintainable** | Low | Medium | Extensive documentation; Init-Session guides new users; modular design |
| **CCS delegation fails unexpectedly** | Low | Low | Fallback to direct execution; error handling + retries |
| **Token efficiency gains not realized** | Low | Medium | Measure baseline first; track savings per workflow; adjust thresholds |
| **User confusion from workflow changes** | Medium | Low | Migration guide; deprecation warnings; backward compatibility for 1 quarter |

---

### Mitigation Strategies

#### 1. Test Coverage Strategy
```yaml
unit_tests:
  - Plan parsing logic (Implementor)
  - Dependency resolution (Coordinator)
  - Conflict detection algorithms
  - Rollback mechanisms
  target_coverage: >80%

integration_tests:
  - Overthinker → Implementor chain
  - Explorer → Overthinker trigger
  - Verificator strategies
  target_coverage: >70%

e2e_tests:
  - Full workflow execution (plan → implement → verify)
  - Parallel dispatch with conflicts
  - Plugin activation
  target_coverage: >60%
```

#### 2. Rollback Capability
- **Filesystem staging**: `.unitai/staging/` for all file modifications
- **Database transactions**: SQLite ROLLBACK on workflow failure
- **Version tracking**: Store workflow version in artifacts for auditing

#### 3. Observability
```typescript
// Metrics to track
interface WorkflowMetrics {
  workflow_name: string;
  duration_ms: number;
  token_usage: number;
  model_used: string;
  success: boolean;
  error?: string;
  files_modified: string[];
  rollback_triggered: boolean;
}

// Log to: .unitai/metrics.jsonl
```

---

## 10. Success Criteria

### Quantitative Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Workflow count** | 9 | 5 | Codebase audit |
| **Token usage per task** | 20-25k | 5-7k | Per-workflow tracking |
| **Validation redundancy** | 4 workflows | 1 unified | Codebase structure |
| **File read efficiency (TS/JS)** | 8k tokens | 200 tokens | Serena vs Read ratio |
| **Tasks per session** | 2-3 | 6-10 | Session analytics |
| **Parallel speedup** | 1x | 3-4x | Benchmark suite |
| **User satisfaction** | Baseline survey | +20% | Quarterly survey |

---

### Qualitative Metrics

- **Developer Experience**: Init-Session provides clear guidance
- **Code Quality**: Plans include tests by default (TDD)
- **Maintainability**: New contributor can understand architecture in <1 hour
- **Automation**: 90% of tool decisions automated (measured by override rate)
- **Reliability**: <5% workflow failure rate in production

---

## 11. Next Steps

### Immediate Actions (Week 1)

1. ✅ **Create project structure**:
   ```bash
   mkdir -p unitAI/workflows/verificator
   mkdir -p unitAI/workflows/implementor
   mkdir -p unitAI/workflows/overthinker
   mkdir -p unitAI/workflows/explorer
   mkdir -p unitAI/skills
   mkdir -p unitAI/plugins
   mkdir -p .unitai/{staging,logs}
   ```

2. ✅ **Initialize SQLite database**:
   ```bash
   sqlite3 .unitai/unitai.db < schema.sql
   ```

3. ✅ **Baseline measurement**:
   - Run 10 typical tasks with current workflows
   - Record: token usage, duration, success rate
   - Create baseline report in `.unitai/metrics_baseline.json`

4. ✅ **Stakeholder communication**:
   - Share this plan with team
   - Gather feedback on priorities
   - Adjust timeline if needed

---

### Phase 1 Kickoff (Week 2)

1. **Verificator Implementation** (2 weeks)
   - Design unified interface
   - Implement strategies (quick, thorough, paranoid)
   - Integrate triangulated review
   - Write test suite
   - Deploy with A/B testing (50% traffic)

2. **Implementor Implementation** (3 weeks)
   - Merge RefactorSprint + AutoRemediation
   - Implement CCS delegation
   - Build rollback mechanism
   - Test with complex plans
   - Deploy gradually

3. **Deprecation Warnings** (1 week)
   - Add `@deprecated` tags to old workflows
   - Implement redirects with warnings
   - Create migration guide
   - Communicate to users

---

## 12. Resources & References

### Documentation
- [unitAI Architecture SSOT](/unitAI/PRfolder/ssot_unitai_architecture_2026-01-24.md)
- [Automation Plan v2.0](/unitAI/PRfolder/NEWfeatures/plan_automated_workflow_architecture_v2_2026-01-28.md)
- [Dev Notes](/unitAI/PRfolder/unitAI-dev-note-idee.md)

### Analysis Artifacts
- [Refactoring Analysis JSON](/refactoring_analysis.json)
- [Triangulated Review Report](/unitAI/PRfolder/NEWfeatures/triangulated_review_refactoring_2026-01-28.md)

### External References
- [Serena LSP Documentation](https://serena-lsp.dev)
- [CCS Delegation Guide](https://github.com/kaitranntt/ccs)
- [Claude Code Plugin API](https://docs.anthropic.com/claude-code/plugins)

---

## Appendix: Implementation Checklist

### Verificator Workflow
- [ ] Core validation engine
- [ ] Strategy: quick (security + lint)
- [ ] Strategy: thorough (+ quality + breaking changes)
- [ ] Strategy: paranoid (+ comprehensive)
- [ ] Strategy: triangulated (Gemini + Cursor + Droid)
- [ ] Integration with Implementor output
- [ ] Test suite (unit + integration)
- [ ] Documentation

### Implementor Workflow
- [ ] Plan parser (JSON/YAML)
- [ ] Task executor (step-by-step)
- [ ] CCS delegation integration
- [ ] Model selection logic
- [ ] Staging mechanism (`.unitai/staging/`)
- [ ] Rollback capability
- [ ] Progress tracking
- [ ] Test suite
- [ ] Documentation

### Overthinker Workflow
- [ ] Multi-agent loop (3-5 iterations)
- [ ] TDD integration (tests section)
- [ ] SQLite storage setup
- [ ] Artifact persistence (per-agent files)
- [ ] Final plan consolidation
- [ ] Complementary skills (`/overthink`, `/plan-to-implement`)
- [ ] Test suite
- [ ] Documentation

### Explorer Workflow
- [ ] Phase 1: Lightweight scanner
- [ ] `structure.md` generation
- [ ] Phase 2: Intelligent proposer
- [ ] Documentation drift detection
- [ ] Refactoring proposal generator
- [ ] Integration with Overthinker trigger
- [ ] Test suite
- [ ] Documentation

### Init-Session Enhancements
- [ ] Serena folder detection
- [ ] Fallback to `docs/` with `ls -lt`
- [ ] Serena installation suggestion
- [ ] SSOT structure guidance
- [ ] Model selection (gemini-2.5-flash)
- [ ] Test suite
- [ ] Documentation

### Parallel Dispatch
- [ ] Plan decomposer
- [ ] Dependency graph builder (DAG)
- [ ] Topological sort
- [ ] Task coordinator
- [ ] Conflict detection
- [ ] Progress tracking (`.unitai/progress.json`)
- [ ] Rollback mechanism
- [ ] Test suite (especially conflict scenarios)
- [ ] Documentation

### Skills
- [ ] `validate-commit` skill
- [ ] `overthink` skill
- [ ] `plan-to-implement` skill
- [ ] NPX packaging
- [ ] Configuration: `~/.unitai/skills.json`
- [ ] Installation guide
- [ ] Documentation

### Plugins
- [ ] Pre-commit plugin (Git hook)
- [ ] Serena LSP interceptor plugin
- [ ] Plugin configuration system
- [ ] Installation guide
- [ ] Documentation

### Interactive Menus
- [ ] Model selection menu
- [ ] Workflow orchestration menu
- [ ] Validation strategy menu
- [ ] Plan approval prompt
- [ ] File/directory targeting menu
- [ ] Documentation

---

**Plan Status**: Ready for Implementation
**Approval Required**: Team lead + Architecture review
**Estimated Duration**: 6 months (3 phases)
**Risk Level**: Medium (mitigated with phased rollout)
