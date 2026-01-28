# Automated Token-Optimized Workflow Architecture v2.0

**Status**: Planning Phase
**Created**: 2026-01-28
**Version**: 2.0 (Automation-First)
**Focus**: Automated decision trees, Serena LSP-first, token-efficient evaluation
**Key Innovation**: 90% automation rate, 75-85% token savings, maintained quality

---

## Executive Summary

**Transformation Goal**: Claude Code evolves from "manual orchestrator" → "automated workflow system"

**Core Changes**:
1. **Serena LSP-First**: All TS/JS operations default to Serena (75-80% savings)
2. **Auto-Delegation Trees**: Task characteristics trigger workflows automatically
3. **Token-Efficient Evaluation**: Delegate grading to agents (don't read files to grade!)
4. **Skill Chaining**: Pre-configured automation sequences

**Expected Impact**:
- Token Savings: 75-85% on typical tasks
- Throughput: 3-4x more tasks per session
- Automation: 90% of tool selection decisions automated
- Quality: Maintained via multi-perspective validation

---

## Implementation Approaches

### Approach A: Plugin-Based Architecture (RECOMMENDED by friend)

**Concept**: Build Claude Code plugins that hook into the tool selection process

**Advantages**:
- Native integration with Claude Code's decision-making
- Can intercept tool calls before execution
- Persistent across sessions (no need to re-explain)
- Can be toggled on/off per project
- Shareable across team/community

**Potential Plugin Types**:

1. **Serena LSP Interceptor Plugin**
   ```yaml
   plugin: serena-lsp-first
   hooks:
     - on_tool_call: Read
       conditions:
         - file_extension in [.ts, .tsx, .js, .jsx]
         - file_size > 300_LOC
       action: redirect_to serena_get_symbols_overview
       reason: "Token efficiency: 200 tokens vs 8k"
   ```

2. **Auto-Delegation Plugin**
   ```yaml
   plugin: auto-delegate-workflows
   hooks:
     - on_task_analysis:
       conditions:
         - task_type: implementation
         - files_affected > 3
       action: suggest_workflow refactor-sprint
       auto_approve: ask_user  # or true for full automation
   ```

3. **Token Budget Guard Plugin**
   ```yaml
   plugin: token-budget-guard
   config:
     per_task_budget: 10000
     warning_threshold: 8000
   hooks:
     - on_token_usage:
       if: usage > warning_threshold
       action: suggest_delegation
       alternatives: [Gemini, Qwen, workflows]
   ```

**Plugin Architecture**:
```
Claude Code
    ├─ Core Decision Engine
    ├─ Tool Registry
    └─ Plugin System
        ├─ Hook Points
        │   ├─ pre_tool_call
        │   ├─ post_tool_call
        │   ├─ on_task_start
        │   └─ on_token_threshold
        │
        ├─ Installed Plugins
        │   ├─ serena-lsp-first.plugin
        │   ├─ auto-delegate.plugin
        │   ├─ token-guard.plugin
        │   └─ evaluation-delegator.plugin
        │
        └─ Plugin Config
            └─ .claude/plugins/config.yaml
```

**Next Steps for Plugin Approach**:
1. Research Claude Code plugin API (if exists)
2. Check if MCP servers can serve as "plugins"
3. Design plugin specification format
4. Build proof-of-concept: Serena LSP interceptor
5. Test with real workflows
6. Package and share

---

### Approach B: Enhanced Skills System (Current Claude Code)

**Concept**: Enhance existing `.claude/skills/` system with automation metadata

**Implementation**: Enhanced skill files with YAML frontmatter:

```yaml
---
name: serena-surgical-editing
version: 2.0
activation:
  auto_trigger: true
  conditions:
    - file_extension: [.ts, .tsx, .js, .jsx]
    - file_size: ">300 LOC"
    - operations: [read, edit, refactor]
workflow:
  phase_1: get_symbols_overview  # 200 tokens
  phase_2: find_symbol --include_body true  # 500 tokens
  phase_3: find_referencing_symbols  # 800 tokens
  phase_4: replace_symbol_body  # auto
token_budget: 2000
escalation:
  threshold: reference_count > 20
  target: refactor-sprint
---

# Skill Content Here
```

**Advantages**:
- Works with current Claude Code (no new infrastructure)
- Easy to share (just .md files)
- Version controlled
- Human-readable

**Disadvantages**:
- Requires Claude to interpret automation rules each session
- No native hook system
- Higher token cost (rules explained each time)

---

## 1. Automation Architecture

### 1.1 Core Principle: Automatic Tool Selection

```typescript
// Current Problem: Manual Decision-Making
User: "Fix Geiger alerts"
Claude: [Thinks 1k tokens] "Should I read files? Use workflow? Which one?"
→ Token waste + slow

// Automated Solution: Decision Tree Triggers
User: "Fix Geiger alerts"
Task Analysis: {
  type: "implementation",
  files_affected: ">3",
  language: "TypeScript"
}
→ AUTO TRIGGER: quick-exploration → serena-surgical-editing → refactor-sprint
→ 9k tokens total (vs 25k manual)
```

### 1.2 Three-Tier Automation System

#### Tier 1: Tool-Level Automation (Serena LSP Default)

| Operation | Traditional | Automated | Savings |
|-----------|------------|-----------|---------|
| Read TS/JS >300 LOC | `Read` (8k tokens) | `Serena get_symbols_overview` (200 tokens) | 97.5% |
| Edit TS/JS method | Read full file → Edit | `Serena find_symbol` → `replace_symbol_body` | 80% |
| Refactor public API | Manual impact check | `Serena find_referencing_symbols` (auto) | 85% |
| Add import | Read full file → Edit | `Serena insert_before_symbol` | 90% |

**Automation Rule**: ANY TS/JS file >300 LOC → Use Serena LSP, no exceptions.

#### Tier 2: Workflow-Level Automation (Skill Chaining)

| Task Pattern | Auto Chain | Token Cost | Manual Cost | Savings |
|--------------|-----------|------------|-------------|---------|
| "Fix [system]" | quick-exploration → serena → refactor-sprint → code-validation | 9.2k | 25-30k | 69% |
| "Review [code]" | serena overview → parallel-review (Gemini+Qwen) | 3.5k | 15-20k | 77% |
| "Add [feature]" | claude-context → feature-design → triangulated-review | 12k | 35-40k | 70% |
| "Debug [issue]" | bug-hunt → auto-remediation → code-validation | 8k | 25-30k | 73% |

**Automation Rule**: Task type + scope → Pre-configured skill chain, auto-execute.

#### Tier 3: Evaluation Automation (Delegate Grading)

**Anti-Pattern** (Current):
```typescript
Agent completes work → Claude reads all files (15k tokens)
→ Claude evaluates → Total waste: 15k+ tokens
```

**Automated Pattern**:
```typescript
Agent completes work → Parallel evaluation delegation:
  ├─ Gemini: "Grade plan adherence @files" (separate context)
  └─ Qwen: "Check quality + edge cases @files" (separate context)
      ↓
Claude synthesizes 2 reports (2k tokens)
→ Total: 2k tokens (87% savings)
```

**Automation Rule**: NEVER read files to evaluate agent work. Always delegate evaluation.

---

## 2. Automated Decision Trees (Implementation Spec)

### 2.1 File Operation Decision Tree

```yaml
trigger: file_operation_needed
decision_tree:
  language_check:
    - if: file_extension in [".ts", ".tsx", ".js", ".jsx"]
      then:
        size_check:
          - if: file_size > 300_LOC
            then: AUTO_USE serena-surgical-editing skill
            workflow:
              1: get_symbols_overview  # 200 tokens
              2: find_symbol (if known target)
              3: find_referencing_symbols (if public API)
              4: replace_symbol_body / rename_symbol / insert_after_symbol

          - if: file_size <= 300_LOC
            then: AUTO_USE direct read

    - if: file_extension in [".json", ".yaml", ".md", ".txt"]
      then: AUTO_USE direct read

    - if: file_extension in [".lock", ".min.js", "dist/*"]
      then: ABORT with message "Avoid generated/vendor files"
```

### 2.2 Context Gathering Decision Tree

```yaml
trigger: context_gathering_needed
decision_tree:
  scope_check:
    - if: files_needed > 5 OR total_LOC > 2000
      then: AUTO_DELEGATE to Gemini
      pattern: |
        mcp__unitAI__ask-gemini --prompt "
          @file1.ts @file2.ts ... @fileN.ts
          Extract: [specific info needed]
          Output: Structured findings only"
      token_cost: ~2.5k (vs 15-20k direct reads)

    - if: unfamiliar_codebase OR session_start
      then: AUTO_USE quick-exploration skill
      workflow:
        1: glob_file_search "**/*.ts"  # 100 tokens
        2: grep "export" --output_mode files_with_matches  # 200 tokens
        3: serena get_symbols_overview (entry points)  # 600 tokens
        4: claude-context search (if needed)  # 1000 tokens
      token_cost: ~2.9k (vs 10-15k exploratory reads)

    - if: semantic_search_needed
      then: AUTO_USE claude-context MCP
      token_cost: ~1k (vs 5-10k grep + reads)
```

### 2.3 Implementation Decision Tree

```yaml
trigger: implementation_task
decision_tree:
  scope_analysis:
    - if: files_affected > 3 OR complexity == "high"
      then: AUTO_DELEGATE to /ai-task run refactor-sprint
      parameters:
        targetFiles: [identified files]
        scope: |
          [Problem statement]

          Requirements:
          - [Req 1]
          - [Req 2]

          Constraints:
          - [Constraint 1]
          - [Constraint 2]

          Success Criteria:
          - [Criterion 1]
          - [Criterion 2]
        depth: "balanced"
        autonomyLevel: "medium"
      token_cost: ~4.5k (vs 20-25k direct implementation)

    - if: files_affected == [2, 3] AND complexity == "medium"
      then: EVALUATE guardrail_cost vs direct_cost
      if_guardrail_cost < 2k:
        AUTO_DELEGATE to refactor-sprint
      else:
        USE serena-surgical-editing + direct implementation

    - if: files_affected == 1 AND complexity == "low"
      then: AUTO_USE serena-surgical-editing
      workflow:
        1: get_symbols_overview
        2: find_symbol --include_body true
        3: replace_symbol_body OR insert_after_symbol
      token_cost: ~1.5k (vs 8-10k read + implement)
```

### 2.4 Validation Decision Tree

```yaml
trigger: validation_needed
decision_tree:
  criticality_check:
    - if: code_type in ["auth", "payment", "security", "core"]
      then: AUTO_DELEGATE to /ai-task run triangulated-review
      parameters:
        files: [modified files]
        goal: "bugfix" OR "refactor"
        autonomyLevel: "read-only"
      agents: Gemini (architecture) + Cursor (code quality) + Droid (operational risks)
      token_cost: ~5k (vs 25k manual review)

    - if: pre_commit == true
      then: AUTO_DELEGATE to /ai-task run pre-commit-validate
      parameters:
        depth: "thorough"  # or "quick" / "paranoid" based on change scope
      token_cost: ~3.5k (vs 15k manual validation)

    - if: quick_check == true
      then: AUTO_USE parallel AI review
      pattern: |
        [Parallel execution]
        mcp__unitAI__ask-gemini --prompt "@files Validate architecture, security"
        mcp__unitAI__ask-qwen --prompt "@files Check quality, edge cases"
      token_cost: ~2.8k (vs 12k sequential)
```

### 2.5 Bug Investigation Decision Tree

```yaml
trigger: bug_reported
decision_tree:
  root_cause_known:
    - if: root_cause == "unknown"
      then: AUTO_DELEGATE to /ai-task run bug-hunt
      parameters:
        symptoms: "[Detailed symptom description]"
        suspected_files: [if any hints available]
        autonomyLevel: "medium"
      workflow: Search → Parallel analysis (Gemini + Cursor) → Droid fix plan
      token_cost: ~4.3k (vs 30k exploratory debugging)

    - if: root_cause == "known" AND location == "known"
      then: AUTO_USE serena-surgical-editing
      workflow:
        1: find_symbol [buggy function]
        2: find_referencing_symbols (check impact)
        3: replace_symbol_body (fix)
        4: auto-remediation (verification plan)
      token_cost: ~2.5k (vs 8-10k direct fix)
```

---

## 3. Skill Enhancement Specifications

### 3.1 serena-surgical-editing (Enhanced)

```yaml
skill_name: serena-surgical-editing
version: 2.0
enhancements:
  - auto_activation: true
  - token_tracking: true
  - escalation_logic: true

activation_conditions:
  file_extension: [".ts", ".tsx", ".js", ".jsx"]
  file_size: ">300 LOC"
  operations: ["read", "edit", "refactor", "rename"]

automated_workflow:
  phase_1_discovery:
    - command: get_symbols_overview
      token_cost: ~200
      output: symbol_map

  phase_2_navigation:
    - if: target_symbol_known
      then: find_symbol --name_path "{target}" --include_body true
      token_cost: ~500
    - else: present symbol_map to user for selection

  phase_3_impact_analysis:
    - if: symbol_is_public_api OR references_unknown
      then: find_referencing_symbols --name_path "{target}"
      token_cost: ~800
      output: reference_count, reference_locations

  phase_4_decision:
    - if: reference_count > 20
      then: ESCALATE to refactor-sprint
      reason: "High impact change, needs comprehensive planning"
    - elif: reference_count > 0 AND change_is_breaking
      then: ASK_USER for confirmation with impact summary
    - else: PROCEED to edit

  phase_5_execution:
    - operations:
        - replace_symbol_body: "Replace entire symbol definition"
        - rename_symbol: "Rename with automatic reference updates"
        - insert_after_symbol: "Add new code after symbol"
        - insert_before_symbol: "Add new code before symbol (e.g., imports)"

token_budget: 2000
escalation_threshold: "reference_count > 20 OR complexity > high"
escalation_target: "/ai-task run refactor-sprint"

integration:
  with_claude_context: "Use for semantic search before Serena"
  with_code_validation: "Use after Serena edits for validation"
  with_unified_ai_orchestration: "Use for AI review of complex changes"
```

### 3.2 quick-exploration (Enhanced)

```yaml
skill_name: quick-exploration
version: 2.0
enhancements:
  - session_memory: true
  - auto_trigger: true
  - progressive_disclosure: true

activation_conditions:
  - session_start: true
  - unfamiliar_codebase: true
  - user_says: ["where is", "how does", "explore", "understand"]

automated_workflow:
  phase_1_structure:
    - glob_file_search "**/*.{ts,tsx,js,jsx}"
      token_cost: ~100
      output: file_tree

  phase_2_entry_points:
    - grep -i "export (class|function|const|default)" --output_mode files_with_matches
      token_cost: ~200
      output: export_files
    - grep -i "new.*Server|createApp|main" --output_mode files_with_matches
      token_cost: ~200
      output: entry_files

  phase_3_minimal_reads:
    - for each entry_file:
        if size < 100_LOC:
          read_file {entry_file}
          token_cost: ~1k each
        else:
          serena get_symbols_overview {entry_file}
          token_cost: ~200 each

  phase_4_semantic_search:
    - if: user_query_semantic
      then: claude-context search_code "{query}"
      token_cost: ~1k

total_token_budget: 3000
savings_vs_traditional: 85-90%

anti_patterns_blocked:
  - no_large_file_reads: "Never read files >300 LOC directly"
  - no_recursive_grep_content: "Always use files_with_matches first"
  - no_vendor_files: "Skip node_modules, dist, .lock files"
```

### 3.3 code-validation (Enhanced)

```yaml
skill_name: code-validation
version: 2.0
enhancements:
  - automated_scope_detection: true
  - parallel_validation: true
  - token_efficient_evaluation: true

activation_conditions:
  - pre_commit: true
  - post_implementation: true
  - significant_change: true

automated_workflow:
  phase_1_scope_detection:
    - analyze_change_scope:
        small: "1-2 files, <200 LOC changed"
        medium: "3-5 files, OR 200-500 LOC changed"
        large: ">5 files, OR >500 LOC, OR architectural"

  phase_2_validation_strategy:
    - if: scope == "small"
      then: quick_validation
      workflow:
        1: Code runs without errors (manual check)
        2: Single AI tool review (Qwen)
           mcp__unitAI__ask-qwen --prompt "@files Quick quality check"
        token_cost: ~1.5k

    - elif: scope == "medium"
      then: parallel_validation
      workflow:
        1: Serena find_referencing_symbols (impact analysis)
           token_cost: ~800
        2: Parallel AI review (Gemini + Qwen)
           [Parallel execution]
           mcp__unitAI__ask-gemini --prompt "@files Architecture, security review"
           mcp__unitAI__ask-qwen --prompt "@files Quality, edge cases"
           token_cost: ~2.5k (separate contexts)
        3: Integration verification (manual or test run)
        token_cost: ~3.3k total

    - elif: scope == "large"
      then: comprehensive_validation
      workflow:
        1: Symbol-level impact (Serena find_referencing_symbols)
        2: Architectural impact (claude-context search)
        3: Parallel AI review (Gemini + Qwen)
        4: Automated test suite (if exists)
        5: triangulated-review (for critical paths)
        token_cost: ~6-8k total

  phase_3_automated_evaluation:
    - NEVER read files to evaluate
    - Synthesize AI reports only
    - Present pass/fail with specific issues
    - Token cost: <2k for synthesis

quality_gates:
  architecture: "Consistent with project patterns"
  security: "No obvious vulnerabilities"
  performance: "No obvious regressions"
  completeness: "All requirements met"
  tests: "Passing (if applicable)"

commit_message_template: |
  {type}: {short description}

  - Validated with {validation_strategy}
  - Scope: {scope_classification}
  - Quality gates: {passed_gates}
```

### 3.4 unified-ai-orchestration (Enhanced)

```yaml
skill_name: unified-ai-orchestration
version: 2.0
enhancements:
  - intelligent_model_selection: true
  - parallel_execution: true
  - result_synthesis: true

model_specializations:
  gemini:
    strengths: ["architecture", "security", "long-term impact", "large context"]
    context_window: ~2M tokens
    best_for: ["design review", "security audit", "pattern analysis"]

  qwen:
    strengths: ["quick checks", "edge cases", "code quality", "refactoring"]
    speed: "fast"
    best_for: ["rapid iteration", "validation", "second opinion"]

  droid:
    strengths: ["autonomous implementation", "operational plans", "fix strategies"]
    autonomy_levels: ["read-only", "low", "medium", "high"]
    best_for: ["remediation plans", "guided fixes", "checklists"]

  cursor:
    strengths: ["refactoring", "concrete improvements", "code generation"]
    availability: "via workflows only"
    best_for: ["refactor plans", "implementation suggestions"]

automated_patterns:
  pattern_1_parallel_validation:
    use_when: "Need multiple perspectives quickly"
    execution: |
      [Parallel execution in single message]
      mcp__unitAI__ask-gemini --prompt "{task from Gemini perspective}"
      mcp__unitAI__ask-qwen --prompt "{task from Qwen perspective}"
    token_cost: "Separate contexts, ~3-5k combined"
    synthesis: "Claude synthesizes 2 reports (~1k tokens)"

  pattern_2_sequential_learning:
    use_when: "Building on previous insights"
    execution: |
      1. Gemini: Design architecture
      2. Cursor (via refactor-sprint): Implement design
      3. Qwen: Quick validation
    token_cost: "~8-12k across phases"

  pattern_3_consensus_validation:
    use_when: "Critical decision needs confidence"
    execution: |
      [All 3 models in parallel]
      Gemini: Long-term impact
      Qwen: Immediate risks
      Droid: Operational checklist
    token_cost: "~6-8k combined"
    synthesis: "Claude identifies consensus and conflicts (~2k tokens)"

automation_rules:
  - single_model: "Simple tasks, clear requirements"
  - parallel_models: "Validation, multiple perspectives needed"
  - sequential_models: "Learning, feature development with stages"
  - always_synthesize: "Never forward raw output, always add context"
```

---

## 4. Implementation Roadmap

### Phase 1: Immediate Activation (Week 1)

**Goal**: Start using automated tools with manual trigger

**Actions**:
1. **Adopt Serena LSP as default**
   - Any TS/JS file >300 LOC → Use Serena automatically
   - Pattern: overview → find_symbol → find_referencing_symbols → edit
   - Track token savings per operation

2. **Use quick-exploration at session start**
   - Run automatically when unfamiliar codebase
   - Replace exploratory file reads with structured approach
   - Measure time to context vs traditional method

3. **Delegate evaluation to agents**
   - Stop reading files to grade agent work
   - Use parallel Gemini + Qwen for evaluation
   - Track evaluation token cost (target: <2k per evaluation)

**Success Metrics**:
- Serena usage: 100% of TS/JS files >300 LOC
- Token savings: 60-70% on file operations
- Evaluation efficiency: <2k tokens per agent output review

### Phase 2: Automation Logic (Weeks 2-3)

**Goal**: Implement decision tree automation

**Actions**:
1. **Create skill enhancement metadata**
   - Add activation_conditions to each skill
   - Define token_budget limits
   - Specify escalation_threshold values
   - Document auto_workflow steps

2. **Build decision tree library**
   - File operations → Serena vs Direct read
   - Context gathering → Gemini vs quick-exploration vs claude-context
   - Implementation → refactor-sprint vs direct vs feature-design
   - Validation → triangulated-review vs parallel-review vs quick check

3. **Test automation patterns**
   - Run 10 typical tasks with manual automation
   - Record: trigger → decision → tool → outcome → tokens
   - Refine thresholds based on results

**Success Metrics**:
- Decision accuracy: >90% optimal tool selection
- Token efficiency: 70-75% savings on automated tasks
- User satisfaction: Maintain or improve perceived quality

### Phase 3: Full Automation (Weeks 4-6)

**Goal**: Automated decision-making becomes default

**Actions**:
1. **Implement auto-trigger system**
   - Task characteristics → Auto-select workflow
   - File size/type → Auto-select tool
   - Scope/complexity → Auto-select delegation level
   - Present automation plan to user for confirmation (1-click approval)

2. **Skill chaining automation**
   - Define common task chains:
     - "Fix [X]" → quick-exploration → serena → refactor-sprint → code-validation
     - "Review [X]" → serena → parallel-review
     - "Add [X]" → claude-context → feature-design → triangulated-review
   - Auto-execute chains with progress updates

3. **Feedback loop system**
   - Track: task type → automation choice → outcome quality → token cost
   - Identify patterns where automation succeeds/fails
   - Adjust thresholds dynamically

**Success Metrics**:
- Automation rate: 90% of decisions automated
- Token efficiency: 75-85% savings overall
- Quality maintenance: Agent output grade ≥40/50 average
- Throughput: 3-4x more tasks completed per session

### Phase 4: Optimization & Learning (Ongoing)

**Goal**: Continuous improvement through data

**Actions**:
1. **Maintain automation metrics dashboard**
   - Token cost per task type (track trends)
   - Automation success rate by category
   - Quality scores by workflow
   - User override frequency (indicates poor automation)

2. **Quarterly review process**
   - Analyze 3 months of automation data
   - Identify high-value improvements
   - Update decision thresholds
   - Create new skill chains for emerging patterns

3. **Share learnings**
   - Document successful automation patterns
   - Share with other Claude instances
   - Contribute improvements to unitAI workflows
   - Build community automation library

**Success Metrics**:
- Continuous improvement: 5-10% efficiency gains per quarter
- New patterns discovered: 2-3 per quarter
- Community adoption: Patterns reused by others

---

## 5. Automation Examples (Real-World Scenarios)

### Example 1: "Fix Geiger Alert System" (Automated)

```typescript
// User Request
"Fix the Geiger Counter alert system integration"

// Automated Decision Tree Execution
[STEP 1: Analyze Task]
Task type: Implementation
Scope: Unknown (triggers exploration)
Language: TypeScript (inferred from context)

[STEP 2: AUTO-TRIGGER quick-exploration]
→ glob_file_search "**/*geiger*.ts" "**/*alert*.ts"
→ Found: 4 files
→ grep "export" in those files
→ serena get_symbols_overview on largest files
Token cost: 2.9k
Result: Identified GeigerCounter.ts, GeigerAlertManager.ts, Dashboard.tsx

[STEP 3: AUTO-TRIGGER serena-surgical-editing]
→ get_symbols_overview for each identified file
Token cost: 600 tokens
Result: Mapped symbol structure

[STEP 4: Scope Analysis]
Files affected: 4 files (>3)
Complexity: Medium-high (alert system integration)
Decision: AUTO-DELEGATE to refactor-sprint

[STEP 5: AUTO-TRIGGER refactor-sprint]
→ Build guardrails from gathered context
→ Invoke: mcp__unitAI__workflow_refactor_sprint
   Parameters:
     targetFiles: [4 identified files]
     scope: |
       Integrate Geiger indicators with VPV2 alert pipeline.
       Requirements: [derived from exploration]
       Constraints: [derived from existing patterns]
       Success Criteria: [standard alert system criteria]
     depth: "balanced"
     autonomyLevel: "medium"
Token cost: 4.5k (separate context)

[STEP 6: AUTO-TRIGGER code-validation]
→ Scope: Medium (4 files)
→ Strategy: parallel_validation
→ Parallel execution:
   - Gemini: Architecture & security review @files
   - Qwen: Quality & edge cases @files
→ Claude synthesizes 2 reports
Token cost: 3.3k

[TOTAL AUTOMATION]
Token cost: 2.9k + 0.6k + 0.5k + 4.5k + 3.3k = 11.8k tokens
Manual approach: 30-35k tokens
Savings: 66% reduction
Time: ~90 seconds (mostly workflow execution)
Quality: Multi-perspective validation (Cursor + Gemini + Droid + Qwen)
```

### Example 2: "Review Payment Module" (Automated)

```typescript
// User Request
"Review the payment gateway integration code"

// Automated Decision Tree Execution
[STEP 1: Analyze Task]
Task type: Validation
Criticality: HIGH (payment = critical code)
Language: TypeScript

[STEP 2: Criticality Check]
Code type: "payment" (triggers high criticality path)
Decision: AUTO-DELEGATE to triangulated-review

[STEP 3: File Discovery]
→ Quick context gathering (if files not specified):
   glob_file_search "**/*payment*.ts"
   serena get_symbols_overview (entry points)
Token cost: ~800 tokens

[STEP 4: AUTO-TRIGGER triangulated-review]
→ Invoke: mcp__unitAI__workflow_triangulated_review
   Parameters:
     files: [identified payment files]
     goal: "refactor" (or "bugfix" based on context)
     autonomyLevel: "read-only"

   Workflow (in separate contexts):
     1. Gemini: Architecture & long-term impact analysis
     2. Cursor: Concrete code improvement suggestions
     3. Droid: Operational checklist + residual risks

Token cost: ~5k (separate contexts for all 3)

[STEP 5: Synthesis]
→ Claude receives 3 independent reports
→ Identifies:
   - Consensus points (all 3 agree)
   - Conflicts (different recommendations)
   - Critical risks (flagged by any agent)
→ Presents unified summary
Token cost: ~2k

[TOTAL AUTOMATION]
Token cost: 0.8k + 5k + 2k = 7.8k tokens
Manual approach: 25-30k tokens (read all files + manual review)
Savings: 74% reduction
Time: ~75 seconds
Quality: 3-way validation (maximum confidence)
```

### Example 3: "Add OAuth Support" (Automated)

```typescript
// User Request
"Add OAuth2 authentication support to the API"

// Automated Decision Tree Execution
[STEP 1: Analyze Task]
Task type: Feature implementation
Scope: Large (new system)
Complexity: High (auth = complex)

[STEP 2: Feature Scope Analysis]
→ Decision: AUTO-DELEGATE to feature-design workflow

[STEP 3: Context Gathering]
→ AUTO-TRIGGER claude-context:
   - Search: "existing authentication patterns"
   - Search: "API structure and middleware"
   - Result: Identifies existing auth patterns to follow
Token cost: ~2k

[STEP 4: AUTO-TRIGGER feature-design]
→ Invoke: mcp__unitAI__workflow_feature_design
   Parameters:
     featureDescription: "Add OAuth2 support to API"
     targetFiles: [identified from context]
     architecturalFocus: "security"
     implementationApproach: "incremental"
     testType: "integration"
     context: [findings from claude-context search]

   Workflow (multi-agent):
     1. ArchitectAgent (Gemini): Designs OAuth2 integration
     2. ImplementerAgent (Cursor): Generates implementation plan
     3. TesterAgent (Droid): Creates test strategy

Token cost: ~10k (separate contexts)

[STEP 5: Validation (Critical Feature)]
→ AUTO-TRIGGER triangulated-review on implementation plan
→ Agents review the plan (not yet implemented)
Token cost: ~5k

[STEP 6: Present to User]
→ Complete OAuth2 integration plan
→ Implementation steps
→ Test strategy
→ Validated by 3+ AI perspectives
→ User can proceed with confidence

[TOTAL AUTOMATION]
Token cost: 2k + 10k + 5k = 17k tokens
Manual approach: 50-60k tokens (explore + design + implement + validate)
Savings: 72% reduction
Time: ~2-3 minutes
Quality: Comprehensive architecture + multi-agent validation
```

### Example 4: "Debug Crash on Startup" (Automated)

```typescript
// User Request
"App crashes on startup with undefined error in auth.ts"

// Automated Decision Tree Execution
[STEP 1: Analyze Task]
Task type: Bug investigation
Root cause: Unknown (only symptom provided)
Language: TypeScript

[STEP 2: Root Cause Check]
→ Known: No
→ Decision: AUTO-DELEGATE to bug-hunt

[STEP 3: AUTO-TRIGGER bug-hunt]
→ Invoke: mcp__unitAI__workflow_bug_hunt
   Parameters:
     symptoms: "App crashes on startup with 'undefined' error in auth.ts"
     suspected_files: ["auth.ts"] (from user message)
     autonomyLevel: "medium"

   Workflow:
     1. Search codebase for auth initialization
     2. Parallel analysis:
        - Gemini: Root cause analysis (deep reasoning)
        - Cursor: Hypothesis generation (patterns)
     3. Droid: Remediation plan creation
     4. Impact analysis on related files

Token cost: ~4.3k (separate contexts)

[STEP 4: Present Findings]
→ Root cause identified: "auth config not initialized before use"
→ Affected files: auth.ts, config.ts, main.ts
→ Fix strategy: Initialize config in main.ts before auth import

[STEP 5: AUTO-TRIGGER Fix Implementation]
→ Scope: 3 files, known fix
→ Decision: Use serena-surgical-editing
→ Workflow:
   1. serena find_symbol in each file
   2. serena find_referencing_symbols (check impact)
   3. serena replace_symbol_body (apply fix)
Token cost: ~2.5k

[STEP 6: Validation]
→ AUTO-TRIGGER quick validation
→ Qwen: "Quick review of fix @files"
Token cost: ~1.2k

[TOTAL AUTOMATION]
Token cost: 4.3k + 2.5k + 1.2k = 8k tokens
Manual approach: 35-40k tokens (explore + debug + fix + verify)
Savings: 80% reduction
Time: ~90 seconds
Quality: AI-guided root cause analysis + validated fix
```

---

## 6. Success Metrics & Monitoring

### 6.1 Token Efficiency Metrics

| Metric | Baseline (Manual) | Target (Automated) | Measurement |
|--------|------------------|-------------------|-------------|
| Avg tokens per task | 20-25k | 5-7k | Per-task tracking |
| File read efficiency | 8k per large file | 200-500 (Serena) | Serena vs Read ratio |
| Evaluation cost | 15k (read files) | 2k (synthesize) | Evaluation phase tracking |
| Context gathering | 10-15k (exploratory) | 2-3k (quick-exploration) | Session start tracking |
| Tasks per session | 2-3 | 6-10 | Session summary |

### 6.2 Automation Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Auto-decision accuracy | >90% | User override rate |
| Serena LSP adoption | 100% of TS/JS >300 LOC | Tool usage logs |
| Workflow auto-trigger | >85% of eligible tasks | Manual vs auto ratio |
| Skill chain success | >90% completion | Chain abort rate |

### 6.3 Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent output quality | ≥40/50 average | Evaluation scores |
| User satisfaction | Maintain or improve | Feedback tracking |
| Re-work rate | <15% | Task revision count |
| Breaking changes caught | 100% | Serena reference checks |

### 6.4 Monitoring Dashboard (Use unitAI RED Metrics)

```bash
# Token efficiency tracking
Track per task:
- Task type
- Tools used (Serena, Gemini, workflows)
- Token cost by phase
- Savings vs manual estimate

# Automation tracking
Track per session:
- Auto-triggered workflows (count)
- Manual overrides (count + reason)
- Decision accuracy (correct/total)

# Quality tracking
After each task:
- Agent output grade (if delegated)
- User feedback (implicit: accepted/revised)
- Breaking change prevention (Serena catches)

# Use existing unitAI dashboard
mcp__unitAI__red-metrics-dashboard({
  timeRangeMinutes: 60,
  component: "all"  // or specific workflow
})

Monitor:
- Rate: Workflow invocations per session
- Errors: Failure rate by type
- Duration: Average completion time
```

---

## 7. Risk Mitigation

### 7.1 Automation Failure Modes

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Wrong tool auto-selected | Medium | Medium | User confirmation before expensive workflows |
| Serena fails on complex code | Low | Low | Fallback to direct read with warning |
| Workflow produces wrong output | Low | High | Parallel validation (Gemini + Qwen) |
| Token budget exceeded | Medium | Medium | Per-skill token limits + escalation |
| Breaking change not caught | Low | Very High | Serena find_referencing_symbols ALWAYS for public APIs |

### 7.2 Fallback Strategies

```yaml
fallback_hierarchy:
  tier_1_serena_failure:
    - if: serena tool errors out
      then: fallback to direct read
      log: "Serena failure: {error}, using direct read"

  tier_2_workflow_failure:
    - if: workflow produces poor output (grade <25/50)
      then:
        option_1: retry with refined guardrails
        option_2: take over manually
      log: "Workflow {name} failed quality gate, score: {score}"

  tier_3_evaluation_failure:
    - if: evaluation agents disagree strongly
      then:
        escalate_to: triangulated-review (3-way validation)
        present: conflict summary to user for decision
      log: "Evaluation conflict: Gemini says {X}, Qwen says {Y}"

  tier_4_token_budget_exceeded:
    - if: skill exceeds token_budget
      then:
        action: pause and present status
        options: ["continue with increased budget", "escalate to higher workflow", "abort"]
      log: "Skill {name} exceeded budget: {used}/{budget}"
```

### 7.3 Quality Safeguards

**Prevent Automation Degradation**:

1. **Always validate public API changes**
   - Serena find_referencing_symbols REQUIRED before public API edits
   - If >20 references → Auto-escalate to refactor-sprint
   - If breaking change → Require user confirmation

2. **Multi-perspective validation for critical code**
   - Payment, auth, security, core → Always use triangulated-review
   - Never single-agent validation for critical paths
   - Require consensus (2/3 agents agree)

3. **Token-efficient evaluation (never read files)**
   - Always delegate evaluation to agents
   - If evaluation uncertain → Request second opinion
   - Track evaluation accuracy over time

4. **Graceful degradation**
   - Automation failure → Fall back to manual with context preserved
   - Keep "take over" option always available
   - User override should be 1-click (not friction)

---

## 8. Plugin Development Roadmap (NEW)

### 8.1 Research Phase

**Goals**:
- Understand Claude Code plugin architecture
- Identify hook points for automation
- Design plugin specification format

**Tasks**:
1. Review Claude Code documentation for plugin API
2. Check if MCP servers can act as automation plugins
3. Study existing Claude Code extensions/plugins (if any)
4. Design `.claude/plugins/` specification format

### 8.2 Proof of Concept: Serena LSP Interceptor

**Goal**: Build first automation plugin

**Specification**:
```yaml
# .claude/plugins/serena-lsp-first.plugin.yaml
name: serena-lsp-first
version: 1.0.0
description: Automatically use Serena LSP for TypeScript/JavaScript files >300 LOC

hooks:
  pre_tool_call:
    - tool: Read
      conditions:
        file_extension: [.ts, .tsx, .js, .jsx]
        file_size: ">300"
      action:
        type: redirect
        target: mcp__serena__get_symbols_overview
        params:
          relative_path: "{original_file_path}"
        message: |
          🔧 Token Optimization: Using Serena LSP instead of full file read
          Estimated savings: ~7.8k tokens (200 vs 8k)
          Use `--force-read` to override

settings:
  enabled: true
  log_decisions: true
  allow_override: true
```

**Implementation Steps**:
1. Create plugin loader system
2. Implement hook registration
3. Add condition evaluation logic
4. Build action dispatcher
5. Test with real workflows
6. Measure token savings

### 8.3 Full Plugin Suite

**Plugins to Build**:

1. **serena-lsp-first.plugin** (Priority 1)
   - Intercepts file reads for TS/JS
   - Redirects to Serena LSP tools
   - Tracks token savings

2. **auto-delegate-workflows.plugin** (Priority 2)
   - Analyzes task characteristics
   - Suggests appropriate workflows
   - Optional auto-approval mode

3. **token-budget-guard.plugin** (Priority 3)
   - Monitors token usage per task
   - Warns at threshold
   - Suggests delegation alternatives

4. **evaluation-delegator.plugin** (Priority 4)
   - Intercepts agent output evaluation
   - Delegates to Gemini + Qwen
   - Synthesizes reports

5. **skill-chain-automation.plugin** (Priority 5)
   - Recognizes common task patterns
   - Triggers pre-configured skill chains
   - Presents automation plan for approval

### 8.4 Plugin Distribution

**Goals**:
- Package plugins for easy sharing
- Create plugin registry
- Enable community contributions

**Distribution Formats**:
```bash
# NPM package
npm install -g @claude-code/plugin-serena-lsp-first

# Git repository
git clone https://github.com/user/claude-plugins.git ~/.claude/plugins/

# Plugin marketplace
claude plugin install serena-lsp-first
```

---

## 9. Next Steps (Post-Approval)

### Immediate (Day 1)
- [ ] Decide: Plugin approach vs Enhanced Skills approach
- [ ] If Plugin: Research Claude Code plugin API
- [ ] If Skills: Create first enhanced skill file
- [ ] Document decision rationale

### Week 1 (Manual Automation Practice)
- [ ] Adopt Serena LSP for ALL TS/JS files >300 LOC (manual)
- [ ] Use quick-exploration at session start (manual)
- [ ] Delegate first agent evaluation (no file reads)
- [ ] Track token savings in notes
- [ ] Run 5 tasks with decision tree logic (manual)

### Weeks 2-3 (Build Automation Infrastructure)
- [ ] If Plugin: Build serena-lsp-first.plugin POC
- [ ] If Skills: Create 4 enhanced skill files
- [ ] Test automation with 10 real tasks
- [ ] Measure token savings vs baseline
- [ ] Refine thresholds based on data

### Month 1 Review
- [ ] Analyze automation success rate
- [ ] Calculate average token savings
- [ ] Identify failure patterns
- [ ] Adjust decision trees
- [ ] Document lessons learned
- [ ] Share findings with community

### Ongoing
- [ ] Maintain automation metrics
- [ ] Quarterly optimization review
- [ ] Build plugin suite (if approach chosen)
- [ ] Contribute to unitAI workflows
- [ ] Build community automation library

---

## Appendix: Quick Reference

### Decision Matrix (1-Pager)

```
TASK TYPE               AUTO-TRIGGER                    TOKEN COST    MANUAL COST    SAVINGS
----------------        ---------------------------     ----------    -----------    -------
Read TS/JS >300 LOC     Serena get_symbols_overview     200           8,000         97.5%
Edit TS/JS method       Serena find → replace           500-1,500     8-10k         85%
Refactor public API     Serena find_referencing         800-2,000     12-15k        87%
Context >5 files        Gemini delegation               2,500         15-20k        87%
Session start           quick-exploration skill         2,900         10-15k        81%
Fix 4+ files            refactor-sprint workflow        4,500         20-25k        82%
Critical review         triangulated-review workflow    5,000         25-30k        83%
Unknown bug             bug-hunt workflow               4,300         30-35k        88%
New feature             feature-design workflow         10,000        50-60k        83%
Evaluate agent work     Parallel Gemini + Qwen          2,000         15k           87%
```

### Tool Selection Flowchart (1-Pager)

```
User Request Received
    │
    ├─ TS/JS file >300 LOC?
    │   └─ YES → USE Serena LSP
    │       ├─ Read: get_symbols_overview (200 tokens)
    │       ├─ Edit: find_symbol → replace_symbol_body (1.5k tokens)
    │       └─ Public API: find_referencing_symbols → escalate if >20 refs
    │
    ├─ Context gathering?
    │   ├─ >5 files → DELEGATE to Gemini (2.5k tokens)
    │   ├─ Unfamiliar → USE quick-exploration (2.9k tokens)
    │   └─ Semantic → USE claude-context (1k tokens)
    │
    ├─ Implementation?
    │   ├─ >3 files → DELEGATE to refactor-sprint (4.5k tokens)
    │   ├─ 2-3 files → EVALUATE (compare costs)
    │   └─ 1 file → USE Serena LSP (1.5k tokens)
    │
    ├─ Validation?
    │   ├─ Critical → DELEGATE to triangulated-review (5k tokens)
    │   ├─ Pre-commit → DELEGATE to pre-commit-validate (3.5k tokens)
    │   └─ Quick → USE parallel Gemini + Qwen (2.8k tokens)
    │
    └─ Bug investigation?
        ├─ Unknown cause → DELEGATE to bug-hunt (4.3k tokens)
        └─ Known location → USE Serena LSP (2.5k tokens)
```

### Token Cost Comparison (Quick Ref)

| Operation | Traditional | Automated | Savings |
|-----------|------------|-----------|---------|
| Read 1 large TS file | 8k | 200 (Serena) | 97.5% |
| Read 5 files | 25k | 2.5k (Gemini) | 90% |
| Explore codebase | 15k | 2.9k (quick-exploration) | 81% |
| Implement 4-file fix | 25k | 4.5k (refactor-sprint) | 82% |
| Critical review | 30k | 5k (triangulated-review) | 83% |
| Evaluate agent output | 15k | 2k (delegate evaluation) | 87% |
| Debug unknown bug | 35k | 4.3k (bug-hunt) | 88% |

---

## Conclusion

This plan provides two viable paths:

1. **Plugin Approach** (RECOMMENDED): Native integration, persistent automation, shareable
2. **Enhanced Skills Approach**: Works with current Claude Code, easier to start

**Key Decision**: Research plugin feasibility first. If Claude Code supports plugins (or can use MCP servers as plugins), prioritize that approach. Otherwise, enhanced skills provide immediate value.

**Next Action**: Research Claude Code plugin architecture and decide on implementation approach.
