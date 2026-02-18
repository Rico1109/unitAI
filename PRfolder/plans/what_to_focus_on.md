# Recovery Plan & Document Analysis

## 1. The "True North" (Vision & Goals)
*Defines what the system SHOULD be. Focus on Autonomy and Orchestration.*

- **Unified Plan:** `docs/deprecated/UNIFIED_AUTONOMOUS_SYSTEM_PLAN.md`
  - *Core Vision:* "Claude as the Boss" -> "UnitAI as the Manager" -> "Specialized Agents".
  - *Key Feature:* **Recursive MCP Architecture** (UnitAI calls other MCPs like Serena/Context7).
  - *Standard:* **Serena-First** (LSP-based navigation/editing) for token efficiency.
- **Detailed Architecture:** `docs/ARCHITECTURE.md`
- **Workflow Definitions:** `docs/deprecated/ARCHIVED_API.md`
- **Implementation Analysis:** `docs/history/IMPLEMENTATION_ANALYSIS.md`
  - *Target:* Granular Permission Model (Interactive `AskUser`).

## 2. Action Plan (The "Reset" Strategy)

### Phase 1: Dynamic Configuration (Immediate Focus)
*Goal: Sanitize hardcoded backends.*
- **Detailed Plan:** `PRfolder/plans/plan_sanitize_hardcoded_backends.md`
- **Task:** Pilot refactor on `parallel-review.workflow.ts` to replace hardcoded `BACKENDS.GEMINI` logic with Role-Based logic.
- **Connection:** Fix `src/cli/setup.tsx` (Wizard) and `src/config/config.ts` to ensure user config is respected.

### Phase 2: The "Recursive Orchestrator" (Investigation)
*Goal: Verify if the "Manager" logic exists.*
- **Task:** Dig deep into code to see if UnitAI *can* currently call other tools/MCPs.
- **Refinement:** If it exists, perfect it. If not, design it.

### Phase 3: Token Efficiency Standard (Serena Integration)
*Goal: Drastically reduce context cost.*
- **Mandate:** Replace standard `read_file` usage in workflows with Serena's `find_symbol`, `get_symbols_overview`, etc.
- **Why:** "Token efficiency is a pillar of UnitAI."

### Phase 4: Safety & Permissions
*Goal: Safe autonomy.*
- **Feature:** Interactive Permission Model.
- **Implementation:** Likely via "Claude AskUser" tool integration.

### Phase 5: Icebox (Deprioritized)
- **Learning Engine / OpenMemory:** Removed from near-term roadmap.

---

## 3. The "Ground Truth" (Current Implementation)
*What actually exists and works today.*

- **Dashboard Guide:** `docs/guides/activity-dashboard.md`
- **Integrations:** `docs/INTEGRATIONS.md`
- **Dashboard & Tracking:** `docs/deprecated/IMPLEMENTATION_SUMMARY_ACTIVITY_DASHBOARD.md`
- **Token Metrics:** `docs/TOKEN_METRICS.md`

## 4. The "Tooling Gap" (Capabilities & Skills)
*What agents CAN do vs. hallucinated capabilities.*

- **Enhancement Plan:** `docs/history/enhancement-plan/README.md`
- **Gap Analysis:** `docs/history/enhancement-plan/mcp-2.0/04_gap_analysis.md`
- **Advanced Patterns (MCPs):** `docs/guides/advanced-patterns.md`
- **Skills & Hooks (Simplified):** `docs/guides/skills-hooks.md`
- **Slash Commands:** `docs/guides/slash-commands.md`
- **Workflows Guide:** `docs/WORKFLOWS.md`
- **Logger Migration:** `docs/logger-migration.md`
- **Skills & Hooks (Archived):** `docs/deprecated/ARCHIVED_CLAUDE_SKILLS_HOOKS_GUIDE.md`
- **Tool Analysis:** `docs/deprecated/TOOL_DESCRIPTIONS_ENHANCED.md`

## 5. Operational & Meta
*Guides on how to use/contribute.*

- **SSOT (Main Doc):** `docs/README.md`
- **Contributing:** `docs/CONTRIBUTING.md`
- **To-Do List:** `docs/task-da-fare.md`

## 6. Ideas & External References (Inbox)
*Brainstorming and external inspiration.*

- **General Note:** The `history` and `mcp-2.0` folder needs deeper understanding but it is quite messy.
- **External Refs:**
  - https://github.com/modu-ai/moai-adk
  - https://github.com/Fission-AI/OpenSpec

---
### Original Context (The Problem)
*unitai refactoring plan (PRfolder) seems to have drifted from its intented scope and lead to a downspiral of agent hallucinations and made up problems masked as important layers dor production readyness.*
*Agent happyly worked and confirmed success after succes without knowing what they where doing and why , the important thing was the thest were passing .*
*Ive stepped back and statted analyzing the /docs folder of the codebase trying to get back on the right track*