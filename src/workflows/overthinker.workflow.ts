import { z } from "zod";
import { executeAIClient, BACKENDS } from "../services/ai-executor.js";
import { getRoleBackend } from "../config/config.js";
import { selectOptimalBackend, createTaskCharacteristics } from "./model-selector.js";
import { getDependencies } from '../dependencies.js';
import { formatWorkflowOutput } from "./utils.js";
import { AutonomyLevel } from "../utils/security/permissionManager.js";
import type { WorkflowDefinition, ProgressCallback, BaseWorkflowParams } from "../domain/workflows/types.js";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { validatePath, validateFilePath } from "../utils/security/pathValidator.js";

/**
 * Overthinker Workflow
 * 
 * A chain-of-thought workflow involving multiple agent personas to refine,
 * reason, critique, and synthesize a solution for a complex problem.
 */

const overthinkerSchema = z.object({
  initialPrompt: z.string().describe("The initial raw idea or request from the user"),
  iterations: z.number().int().min(1).max(10).default(3).optional()
    .describe("Number of review/refinement iterations (default: 3)"),
  contextFiles: z.array(z.string()).optional()
    .describe("List of file paths to provide as context"),
  outputFile: z.string().optional().default("overthinking.md")
    .describe("Filename for the final output (saved under .unitai/ unless absolute path provided)"),
  modelOverride: z.string().optional()
    .describe("Specific model/backend to use for all steps (default: auto)"),
  autonomyLevel: z.enum(["auto", "read-only", "low", "medium", "high"])
    .describe('Ask the user: "What permission level for this workflow? auto = I choose the minimum needed, read-only = analysis only, low = file writes allowed, medium = git commit/branch/install deps, high = git push + external APIs." Use auto if unsure.')
});

export type OverthinkerParams = z.infer<typeof overthinkerSchema> & BaseWorkflowParams;

export async function executeOverthinker(
  params: OverthinkerParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const { 
    initialPrompt, 
    iterations = 3, 
    contextFiles = [], 
    outputFile = "overthinking.md",
    modelOverride
  } = params;

  onProgress?.(`🧠 Starting Overthinker workflow for: "${initialPrompt.slice(0, 50)}"...`);

  // 1. Gather Context
  let gatheredContext = "";
  for (const file of contextFiles) {
    if (existsSync(file)) {
      try {
        // SECURITY: Validate file path to prevent path traversal attacks
        const validatedFilePath = validateFilePath(file);
        const content = readFileSync(validatedFilePath, 'utf-8');
        gatheredContext += `
--- File: ${file} ---
${content}
`;
      } catch (e) {
        onProgress?.(`⚠️ Could not read context file ${file}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Also check for project standards if not explicitly provided
  const projectStandardsFiles = ['CLAUDE.MD', '.gemini/GEMINI.md'];
  for (const file of projectStandardsFiles) {
     if (existsSync(file) && !contextFiles.includes(file)) {
        try {
            // SECURITY: Validate file path to prevent path traversal attacks
            const validatedFilePath = validateFilePath(file);
            const content = readFileSync(validatedFilePath, 'utf-8');
            gatheredContext += `
--- Project Standards (${file}) ---
${content}
`;
        } catch (e) {
            // ignore
        }
     }
  }

  const history: { step: string; content: string; agent: string }[] = [];
  
  const { circuitBreaker } = getDependencies();
  const task = createTaskCharacteristics('overthinker', { requiresCreativity: true, complexity: 'high', requiresArchitecturalThinking: true });
  
  let selectedBackend = modelOverride;
  if (!selectedBackend) {
     selectedBackend = await selectOptimalBackend(task, circuitBreaker, [getRoleBackend('architect')]);
  }
  const backendToUse = selectedBackend;

  // ============================================================================ 
  // PHASE 1: PROMPT REFINER
  // ============================================================================ 
  onProgress?.("✨ Phase 1: Refining Prompt...");
  
  const refinerPrompt = `
    You are an expert AI Prompt Engineer and System Architect.
    Your goal is to refine the User's Initial Request into a "Master Prompt" that will guide a team of AI agents.

    **Context:**
    ${gatheredContext.slice(0, 10000)} ${gatheredContext.length > 10000 ? "...(truncated)" : ""}

    **User Request:**
    ${initialPrompt}

    **Instructions:**
    1. Analyze the request and context.
    2. Clarify ambiguous points.
    3. Define strict constraints, scope, and technological requirements.
    4. Add XML tags or structured sections where beneficial.
    5. IF specific libraries are mentioned, implicitly verify best practices in your instructions.

    Output ONLY the Refined Master Prompt. Do not add conversational filler.
  `;

  let masterPrompt = "";
  try {
    masterPrompt = await executeAIClient({
      backend: backendToUse,
      prompt: refinerPrompt,
      outputFormat: "text"
    });
    history.push({ step: "Master Prompt", agent: "Prompt Refiner", content: masterPrompt });
    onProgress?.("✅ Master Prompt generated.");
  } catch (e: unknown) {
    throw new Error(`Failed in Phase 1: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Save Master Prompt immediately (to .unitai directory)
  try {
    const outputDir = ".unitai";
    const masterPromptFile = join(outputDir, `master_prompt_${new Date().getTime()}.md`);

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // SECURITY: Validate output path to prevent path traversal attacks
    const validatedMasterPromptPath = validatePath(masterPromptFile, process.cwd());
    writeFileSync(validatedMasterPromptPath, masterPrompt);
    onProgress?.(`💾 Saved master prompt to: ${masterPromptFile}`);
  } catch (e: unknown) {
    onProgress?.(`⚠️ Could not save master prompt: ${e instanceof Error ? e.message : String(e)}`);
    // Don't fail the workflow if master prompt can't be saved (it's logged in history anyway)
  }


  // ============================================================================ 
  // PHASE 2: INITIAL REASONING
  // ============================================================================ 
  onProgress?.("💡 Phase 2: Initial Reasoning...");

  const reasonerPrompt = `
    You are the Lead Solutions Architect.
    You are the first to tackle this problem based on the Master Prompt.

    **Master Prompt:**
    ${masterPrompt}

    **Instructions:**
    1. Brainstorm deep and wide.
    2. Propose a concrete plan or solution.
    3. Explain your reasoning for key decisions.
    4. Structure your response clearly (Markdown).

    Output your Detailed Initial Thinking.
  `;

  let currentThinking = "";
  try {
    currentThinking = await executeAIClient({
      backend: backendToUse,
      prompt: reasonerPrompt,
      outputFormat: "text"
    });
    history.push({ step: "Initial Reasoning", agent: "Lead Architect", content: currentThinking });
    onProgress?.("✅ Initial reasoning completed.");
  } catch (e: unknown) {
     throw new Error(`Failed in Phase 2: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ============================================================================ 
  // PHASE 3: ITERATIVE REVIEW LOOP
  // ============================================================================ 
  
  for (let i = 1; i <= iterations; i++) {
    onProgress?.(`🔄 Phase 3: Iteration ${i}/${iterations} (Review & Refine)...`);
    
    const reviewerPrompt = `
      You are Reviewer Agent #${i}.
      Your goal is to CRITIQUE and IMPROVE the current state of thinking.

      **Master Prompt:**
      ${masterPrompt}

      **Current Thinking / Plan:**
      ${currentThinking}

      **Instructions:**
      1. Identify logic gaps, security risks, or inefficiencies.
      2. Suggest concrete improvements.
      3. If the plan is good, expand on implementation details or edge cases.
      4. Rewrite/Append to the "Current Thinking" to reflect your improved version. 
       - You can completely restructure it if necessary, but keep valuable insights.
       - Use a section "**Reviewer #${i} Notes**" to highlight your specific changes.

      Output the IMPROVED Thinking.
    `;

    try {
      const improvedThinking = await executeAIClient({
        backend: backendToUse,
        prompt: reviewerPrompt,
        outputFormat: "text"
      });
      currentThinking = improvedThinking;
      history.push({ step: `Iteration ${i}`, agent: `Reviewer #${i}`, content: currentThinking });
      onProgress?.(`✅ Iteration ${i} completed.`);
    } catch (e: unknown) {
      // FAIL-FAST: Phase 3 iteration failure stops the entire workflow
      throw new Error(`Failed in Phase 3, Iteration ${i}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ============================================================================ 
  // PHASE 4: CONSOLIDATION
  // ============================================================================ 
  onProgress?.("📝 Phase 4: Final Consolidation...");

  const consolidatorPrompt = `
    You are the Final Synthesizer.
    Your job is to produce the final "Overthinking" document.

    **Master Prompt:**
    ${masterPrompt}

    **Final State of Thinking:**
    ${currentThinking}

    **Instructions:**
    1. Create a polished, comprehensive Markdown document.
    2. Include:
       - **Executive Summary**: High-level overview.
       - **Master Prompt**: The refined scope (briefly).
       - **Detailed Solution**: The final evolved plan.
       - **Reasoning Process**: Briefly mention how the solution evolved (e.g., "After reviewing security...").
       - **Implementation Steps**: Concrete next actions.
    3. Ensure the tone is professional and authoritative.

    Output the FINAL DOCUMENT content only.
  `;

  let finalDocument = "";
  try {
    finalDocument = await executeAIClient({
        backend: backendToUse,
        prompt: consolidatorPrompt,
        outputFormat: "text"
    });
    history.push({ step: "Final Synthesis", agent: "Consolidator", content: finalDocument });
    onProgress?.("✅ Final synthesis completed.");
  } catch (e: unknown) {
    // FAIL-FAST: Phase 4 synthesis failure stops the entire workflow
    throw new Error(`Failed in Phase 4 (Final Consolidation): ${e instanceof Error ? e.message : String(e)}`);
  }

  // Save to file
  try {
    const outputDir = ".unitai";
    const finalOutputPath = outputFile.includes("/") ? outputFile : join(outputDir, outputFile);

    if (!existsSync(dirname(finalOutputPath))) {
        try {
            mkdirSync(dirname(finalOutputPath), { recursive: true });
        } catch (e) {
            onProgress?.(`⚠️ Could not create directory for ${finalOutputPath}`);
        }
    }

    // SECURITY: Validate output path to prevent path traversal attacks
    const validatedOutputPath = validatePath(finalOutputPath, resolve('.unitai'));
    writeFileSync(validatedOutputPath, finalDocument);
    onProgress?.(`💾 Saved final output to: ${finalOutputPath}`);
  } catch (e: unknown) {
    onProgress?.(`⚠️ Could not write file: ${e instanceof Error ? e.message : String(e)}`);
  }

  return formatWorkflowOutput(
    `Overthinker: ${initialPrompt.slice(0, 30)}...`,
    finalDocument,
    { historyStepCount: history.length, outputFile }
  );
}

export const overthinkerWorkflow: WorkflowDefinition = {
  name: "overthinker",
  description: "A deep reasoning loop using multiple AI personas to refine, critique, and perfect an idea.",
  schema: overthinkerSchema,
  execute: executeOverthinker
};
