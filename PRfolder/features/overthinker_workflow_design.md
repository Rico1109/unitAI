# Overthinker Workflow Design (v1)

## Overview
The **Overthinker** workflow is a specialized "Chain-of-Thought" planning tool designed to simulate a multi-agent team refining a complex problem. It does not implement code directly; instead, it produces a high-quality, iterated architectural plan.

## Core Philosophy
- **"Measure twice, cut once"**: Spend tokens on planning to save tokens on implementation.
- **Iterative Refinement**: A plan that has been critiqued 3 times is exponentially better than a zero-shot plan.
- **Persona-based**: Different AI "personas" (Refiner, Architect, Reviewer) provide diverse perspectives.

## Architecture: The 4 Phases

1.  **Phase 1: Prompt Refiner**
    *   **Input**: Raw user request + Context files.
    *   **Goal**: Create a "Master Prompt" that is unambiguous, constrained, and technically precise.
    *   **Persona**: Expert Prompt Engineer.

2.  **Phase 2: Initial Reasoner**
    *   **Input**: Master Prompt.
    *   **Goal**: Generate a "Strawman" proposal or initial architectural draft.
    *   **Persona**: Lead Solutions Architect.

3.  **Phase 3: Iterative Review Loop (The "Overthinking")**
    *   **Input**: Master Prompt + Current Plan.
    *   **Goal**: Critique logic gaps, security risks, and edge cases.
    *   **Persona**: Reviewer Agent (iterates 1..N times).
    *   **Mechanism**: The agent *rewrites* or *appends* to the plan, improving it with each pass.

4.  **Phase 4: Consolidator**
    *   **Input**: Final Iterated Plan.
    *   **Goal**: Polish into a readable, authoritative Markdown document.
    *   **Persona**: Technical Writer / Synthesizer.

## Refactoring & Implementation Plan

### Identified Improvements
Current implementation (prototype) needs the following improvements before production use:

1.  **Modularization**: Break the monolithic `executeOverthinker` function into dedicated phase handlers.
2.  **Async I/O**: Migrate from `fs.readFileSync` to `fs/promises` for non-blocking operations.
3.  **Configuration**: Centralize prompts and "magic numbers" (e.g., max iterations) into a config object.
4.  **Security**: Strict path validation for all inputs and outputs.

### Proposed Code Structure

```typescript
import { z } from "zod";
import { executeAIClient, BACKENDS } from "../utils/aiExecutor.js";
import { formatWorkflowOutput } from "./utils.js";
import { AutonomyLevel } from "../utils/permissionManager.js";
import type { WorkflowDefinition, ProgressCallback, BaseWorkflowParams } from "./types.js";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { validatePath, validateFilePath } from "../utils/pathValidator.js";

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const OVERTHINKER_CONFIG = {
  defaultOutputDir: ".unitai",
  defaultIterations: 3,
  maxIterations: 10,
  projectStandardsFiles: ['CLAUDE.MD', '.gemini/GEMINI.md'],
  maxContextLength: 10000
};

const PROMPTS = {
  REFINER: (context: string, initialPrompt: string) => `...`,
  REASONER: (masterPrompt: string) => `...`,
  REVIEWER: (i: number, masterPrompt: string, currentThinking: string) => `...`,
  CONSOLIDATOR: (masterPrompt: string, currentThinking: string) => `...`
};

// ... Zod Schema Definition ...

// ============================================================================
// PHASE HANDLERS (Async)
// ============================================================================

async function runRefinerPhase(...) { ... }
async function runReasonerPhase(...) { ... }
async function runReviewLoop(...) { ... }
async function runConsolidatorPhase(...) { ... }

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function executeOverthinker(params: OverthinkerParams, onProgress?: ProgressCallback): Promise<string> {
  // 1. Validate & Setup
  // 2. Phase 1: Refiner
  // 3. Phase 2: Reasoner
  // 4. Phase 3: Loop
  // 5. Phase 4: Consolidate
  // 6. Save & Return
}
```

## Integration Roadmap

1.  **Deploy Refactored Workflow**: Update `src/workflows/overthinker.workflow.ts`.
2.  **Add Skill Access**: Create `/overthink` skill in `.claude/skills` to allow easy invocation.
3.  **Connect to Feature Design**: Allow `feature-design` workflow to call `overthinker` as a subroutine for complex tasks.
