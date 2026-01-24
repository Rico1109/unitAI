# Strategic Architecture Review: Dynamic Reasoning Engine for UnitAI

## Executive Summary
The UnitAI project requires a paradigm shift from rigid, linear workflow execution to a dynamic, adaptive "Reasoning Engine." This document outlines the architectural blueprint for implementing a managed **ReAct (Reason+Act) loop**. This system allows workflows to self-modify at runtime—injecting research steps, backtracking on errors, and delegating sub-tasks—while maintaining strict safety bounds and backward compatibility with existing critical infrastructure. By decoupling step execution from control flow, we enable the system to "think" about its next move based on intermediate results.

---

## Master Prompt Scope
**Objective:** Evolve `src/workflows` and `src/agents` to support **dynamic, complex multi-step reasoning**.

*   **Current Limitation:** Workflows are currently static, imperative TypeScript functions (linear sequences) incapable of adapting to unexpected intermediate data without hardcoded branching.
*   **Target State:** An architecture where the execution path is determined dynamically by the AI's reasoning, allowing for loops, recursive investigation, and self-correction.
*   **Constraints:**
    *   Must maintain compatibility with `mcp__unitAI__smart-workflows`.
    *   **Safety First:** Strict token budgets, step limits, and regression testing for `init-session`.
    *   **Tooling:** Adherence to `CLAUDE.MD` standards (Serena for code access, Claude Context for search).

---

## Detailed Solution: The Reasoning Engine Architecture

To bridge the gap between static orchestration and dynamic reasoning, we propose a new core component: the **Reasoning Engine**.

### 1. The Core Engine (`src/workflows/reasoning/ReasoningEngine.ts`)
This is not just a loop; it is a **Managed State Machine** responsible for safety and persistence.
*   **The ReAct Loop:**
    1.  **Evaluate Context:** Analyze the `ContextBoard` (history/artifacts).
    2.  **Select Action:** Execute the next step in the queue.
    3.  **Process Result:** Determine if the plan needs modification (Add/Remove steps) or if the workflow should terminate.
*   **Safety Mechanisms:**
    *   `maxSteps`: A hard limit (e.g., 10 iterations) to prevent infinite loops.
    *   **Budget Watchdog:** Monitors token consumption per step.
    *   **Persistence:** Writes a `reasoning_state.json` checkpoint to `.gemini/tmp/` after every atomic action, ensuring resume capability on crash.

### 2. The Context Board (`Shared Reasoning Memory`)
We extend the existing `WorkflowContext` to become a central "Blackboard" system.
*   **Trace Log:** A chronological, immutable record of `[Timestamp] [StepName] [Reasoning] [Result]`.
*   **Artifacts:** A structured repository for code blocks, file summaries, and decisions that persist across steps.
*   **Tool Inventory:** A dynamic registry of available "moves" (e.g., `SearchStep`, `WriteCodeStep`) available to the Planner.

### 3. Dual-Mode Step Execution & The Fallback Planner
A critical innovation in this design is handling "dumb" tools (tools that just return data) vs. "smart" agents (agents that return control signals).
*   **Smart Steps:** Return a `ReasoningResult` containing a **Control Signal** (e.g., `ADD_STEPS: [ReviewCode]`, `TERMINATE`).
*   **Dumb Steps:** Return raw data (e.g., a file content string).
*   **The Fallback Planner:** If the Engine executes a "Dumb Step" and receives no control signal, it automatically triggers an internal **Meta-Planner Step**. This Planner reads the Context Board (e.g., "I just read file X") and decides the next logical move, appending it to the queue.

### 4. Dynamic Step Interface (Adapter Pattern)
We wrap existing `BaseAgent` implementations in a lightweight adapter to make them compatible with the reasoning loop without rewriting legacy code.
```typescript
interface ReasoningResult {
  success: boolean;
  output: any;
  controlSignal?: {
    type: 'CONTINUE' | 'ADD_STEPS' | 'REPLACE_PLAN' | 'TERMINATE';
    newSteps?: ReasoningStep[]; 
  };
}
```

---

## Reasoning Process
The evolution of this architecture was driven by specific discoveries during the analysis phase:

1.  **Rigidity of Static DAGs:** Analysis of `aiExecutor.ts` revealed that state transfer was manual and fragile. Moving to a "Context Board" model was necessary to decouple steps.
2.  **The "Smart Agent" Fallacy:** Initial designs assumed every step could decide "what to do next." This is risky and complex. The **Fallback Planner** was introduced to centralize decision-making logic when simple tools are used, keeping individual steps focused and simple.
3.  **Safety & Persistence:** Given the non-deterministic nature of dynamic loops, adding **checkpoints** (`reasoning_state.json`) is non-negotiable for debugging and reliability.

---

## Implementation Steps (Phase 3)

1.  **Scaffold Infrastructure (`src/workflows/reasoning/`)**
    *   Create `types.ts`: Define `ReasoningStep`, `ReasoningResult`, `ControlSignal`.
    *   Create `ContextBoard.ts`: Implement state management with file-based checkpointing.
    *   Create `ReasoningEngine.ts`: Implement the core loop with the Fallback Planner logic.

2.  **Refactor Core**
    *   Update `WorkflowContext` to support the "Trace" logging mechanism required by the Engine.

3.  **Prototype Workflow (`deep-reasoning.workflow.ts`)**
    *   Implement a concrete example: "Research Topic X".
    *   **Flow:** Planner -> (Dynamic) Search -> (Dynamic) Read -> Planner (Synthesize) -> Terminate.

4.  **Verification**
    *   **Dry Run:** Execute the prototype with mocked tool outputs.
    *   **Regression Test:** Run `npm test tests/integration/init-session.test.ts` to ensure the existing `init-session` workflow remains unaffected.
