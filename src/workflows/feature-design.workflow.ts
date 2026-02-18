import { z } from "zod";
import { AgentFactory } from "../agents/index.js";
import { createAgentConfig, formatAgentResults, formatWorkflowOutput } from "./utils.js";
import { AutonomyLevel } from "../utils/security/permissionManager.js";
import { executeAIClient } from "../services/ai-executor.js";
import { getRoleBackend } from "../config/config.js";
import { selectOptimalBackend, createTaskCharacteristics } from "./model-selector.js";
import { getDependencies } from '../dependencies.js';
import type {
  WorkflowDefinition,
  ProgressCallback
} from "../domain/workflows/types.js";

/**
 * Feature Design Workflow - Orchestration Example
 *
 * This workflow demonstrates the orchestration of all three specialized agents:
 * 1. ArchitectAgent - Designs the architecture and approach
 * 2. ImplementerAgent - Generates production-ready code
 * 3. TesterAgent - Creates comprehensive tests
 *
 * Use Case: End-to-end feature development from design to tests
 */

/**
 * Zod schema for feature-design workflow
 */
const featureDesignSchema = z.object({
  featureDescription: z.string()
    .describe("Description of the feature to implement"),
  targetFiles: z.array(z.string())
    .describe("Files to create or modify"),
  context: z.string().optional()
    .describe("Additional context about the project"),
  architecturalFocus: z.enum(["design", "refactoring", "optimization", "security", "scalability"])
    .optional().default("design")
    .describe("Focus of the architectural analysis"),
  implementationApproach: z.enum(["incremental", "full-rewrite", "minimal"])
    .optional().default("incremental")
    .describe("Implementation approach"),
  testType: z.enum(["unit", "integration", "e2e"])
    .optional().default("unit")
    .describe("Type of tests to generate"),
  autonomyLevel: z.nativeEnum(AutonomyLevel)
    .optional().describe("Autonomy level for workflow operations (default: read-only)"),
  validationBackends: z.array(z.enum(["ask-gemini", "cursor-agent", "droid"]))
    .optional()
    .describe("Additional backends to validate the generated plan"),
  attachments: z.array(z.string())
    .optional()
    .describe("Support files (e.g. specifications, logs) to attach to additional backends")
});

export type FeatureDesignParams = z.infer<typeof featureDesignSchema>;

/**
 * Executes the feature design workflow
 *
 * Orchestration Flow:
 * 1. Architecture Phase - ArchitectAgent analyzes and designs
 * 2. Implementation Phase - ImplementerAgent generates code
 * 3. Testing Phase - TesterAgent creates tests
 */
export async function executeFeatureDesign(
  params: FeatureDesignParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const {
    featureDescription,
    targetFiles,
    context,
    architecturalFocus,
    implementationApproach,
    testType,
    validationBackends = [],
    attachments = []
  } = params;

  onProgress?.(`🎯 Starting feature design workflow for: ${featureDescription}`);

  // Create agent config from workflow params
  const agentConfig = createAgentConfig(params, onProgress);

  const { circuitBreaker } = getDependencies();

  let finalOutput = "";
  const metadata: Record<string, any> = {
    featureDescription,
    targetFiles,
    timestamp: new Date().toISOString(),
    phases: [],
    validationBackends,
    attachments
  };

  // ============================================================================
  // PHASE 1: Architectural Design (ArchitectAgent)
  // ============================================================================

  try {
    onProgress?.("📐 Phase 1: Architectural Analysis and Design");

    // Dynamic Backend Selection for Architecture
    const archTask = createTaskCharacteristics('architecture');
    archTask.requiresArchitecturalThinking = true;
    const archBackend = await selectOptimalBackend(archTask, circuitBreaker);

    const architect = AgentFactory.createArchitect();
    const architectResult = await architect.execute(
      {
        task: `Design the architecture for the following feature:\n\n${featureDescription}`,
        context,
        files: targetFiles,
        focus: architecturalFocus
      },
      { ...agentConfig, backendOverride: archBackend }
    );

    // Format and append architect results
    finalOutput += formatAgentResults(architectResult, "ArchitectAgent");
    finalOutput += "\n\n---\n\n";

    metadata.phases.push({
      phase: "architecture",
      success: architectResult.success,
      backend: architectResult.metadata?.backend,
      executionTime: architectResult.metadata?.executionTime
    });

    // Check if architecture phase succeeded
    if (!architectResult.success) {
      onProgress?.("⚠️ Architecture phase failed, continuing with implementation...");
    } else {
      onProgress?.("✅ Architecture phase completed successfully");
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onProgress?.(`❌ Architecture phase error: ${errorMsg}`);
    finalOutput += `## ⚠️ Architecture Phase Error\n\n${errorMsg}\n\n---\n\n`;
  }

  // ============================================================================
  // PHASE 2: Code Implementation (ImplementerAgent)
  // ============================================================================

  try {
    onProgress?.("💻 Phase 2: Code Implementation");

    // Dynamic Backend Selection for Implementation
    const implTask = createTaskCharacteristics('implementation');
    implTask.requiresCodeGeneration = true;
    const implBackend = await selectOptimalBackend(implTask, circuitBreaker);

    const implementer = AgentFactory.createImplementer();
    let implementerResult = await implementer.execute(
      {
        task: featureDescription,
        targetFiles,
        codeContext: context,
        approach: implementationApproach
      },
      { ...agentConfig, backendOverride: implBackend }
    );

    // Format and append implementer results
    finalOutput += formatAgentResults(implementerResult, "ImplementerAgent");
    finalOutput += "\n\n---\n\n";

    metadata.phases.push({
      phase: "implementation",
      success: implementerResult.success,
      backend: implementerResult.metadata?.backend,
      executionTime: implementerResult.metadata?.executionTime,
      changedFiles: implementerResult.output.changedFiles?.length || 0
    });

    if (!implementerResult.success) {
      onProgress?.("⚠️ Implementation phase failed, continuing with tests...");
    } else {
      onProgress?.("✅ Implementation phase completed successfully");
    }
    if (!implementerResult.success) {
      onProgress?.("🛠️ Implementer fallback for implementation suggestions...");
      try {
        const fallbackPlan = await executeAIClient({
          backend: getRoleBackend('implementer'),
          prompt: `Feature: ${featureDescription}\n\nTarget files: ${targetFiles.join(", ")}\n\nContext (if available):\n${context || "N/A"}\n\nGenerate concrete implementation suggestions (patch outline, risks, recommended tests).`,
          attachments: attachments.length ? attachments : targetFiles.slice(0, 3),
          outputFormat: "text",
          autoApprove: false
        });
        finalOutput += `\n## Implementer Fallback Suggestions\n\n${fallbackPlan}\n\n---\n\n`;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        finalOutput += `\n## Implementer Fallback Suggestions\n\nUnable to generate suggestions: ${errorMsg}\n\n---\n\n`;
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onProgress?.(`❌ Implementation phase error: ${errorMsg}`);
    finalOutput += `## ⚠️ Implementation Phase Error\n\n${errorMsg}\n\n---\n\n`;
  }

  // ============================================================================
  // PHASE 3: Test Generation (TesterAgent)
  // ============================================================================

  try {
    onProgress?.("🧪 Phase 3: Test Generation");

    // Dynamic Backend Selection for Testing
    const testTask = createTaskCharacteristics('testing');
    testTask.requiresSpeed = true; // Testing usually benefits from speed
    const testBackend = await selectOptimalBackend(testTask, circuitBreaker);

    const tester = AgentFactory.createTester();
    const testerResult = await tester.execute(
      {
        targetCode: `// Feature: ${featureDescription}\n// Files: ${targetFiles.join(", ")}`,
        testType,
        framework: "jest",
        coverageGoal: 80
      },
      { ...agentConfig, backendOverride: testBackend }
    );

    // Format and append tester results
    finalOutput += formatAgentResults(testerResult, "TesterAgent");
    finalOutput += "\n\n---\n\n";

    metadata.phases.push({
      phase: "testing",
      success: testerResult.success,
      backend: testerResult.metadata?.backend,
      executionTime: testerResult.metadata?.executionTime,
      testCount: testerResult.output.testCount,
      coverage: testerResult.output.estimatedCoverage
    });

    if (!testerResult.success) {
      onProgress?.("⚠️ Test generation phase failed");
    } else {
      onProgress?.("✅ Test generation phase completed successfully");
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onProgress?.(`❌ Test generation phase error: ${errorMsg}`);
    finalOutput += `## ⚠️ Test Generation Phase Error\n\n${errorMsg}\n\n---\n\n`;
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================

  const successfulPhases = metadata.phases.filter((p: any) => p.success).length;
  const totalPhases = metadata.phases.length;
  const overallSuccess = successfulPhases === totalPhases;

  finalOutput += `## 📊 Workflow Summary\n\n`;
  finalOutput += `**Overall Status:** ${overallSuccess ? "✅ SUCCESS" : "⚠️ PARTIAL SUCCESS"}\n\n`;
  finalOutput += `**Phases Completed:** ${successfulPhases}/${totalPhases}\n\n`;

  finalOutput += `### Phase Results\n\n`;
  metadata.phases.forEach((phase: any) => {
    const statusIcon = phase.success ? "✅" : "❌";
    finalOutput += `- ${statusIcon} **${phase.phase}**: ${phase.backend} (${phase.executionTime}ms)\n`;
  });

  finalOutput += `\n### Next Steps\n\n`;
  if (overallSuccess) {
    finalOutput += `1. Review the architectural design and implementation plan\n`;
    finalOutput += `2. Implement the suggested code changes\n`;
    finalOutput += `3. Add the generated tests to your test suite\n`;
    finalOutput += `4. Run tests and validate coverage\n`;
    finalOutput += `5. Commit changes with proper documentation\n`;
  } else {
    finalOutput += `1. Review the failed phases and error messages\n`;
    finalOutput += `2. Address any blocking issues\n`;
    finalOutput += `3. Re-run the workflow or execute failed phases individually\n`;
  }

  if (validationBackends.length > 0) {
    onProgress?.("🔎 Additional validation with selected backends...");
    const validationOutputs: string[] = [];

    const archRole = getRoleBackend('architect');
    const implRole = getRoleBackend('implementer');
    const roleValidationBackends = [...new Set([archRole, implRole])];
    const roleLabels: Record<string, string> = {
      [archRole]: 'Architect Validation',
      [implRole]: 'Implementer Validation'
    };

    for (const backend of roleValidationBackends) {
      const label = roleLabels[backend] ?? `${backend} Validation`;
      let output = "";
      try {
        const isArchitect = backend === archRole;
        output = await executeAIClient({
          backend,
          prompt: isArchitect
            ? `Validate the following feature plan and highlight architectural risks.\n\nFeature: ${featureDescription}\nTarget files: ${targetFiles.join(", ")}\n\nPlan:\n${finalOutput}`
            : `Review this feature plan and suggest improvements or missing implementation steps.\n\nFeature: ${featureDescription}\nPlan:\n${finalOutput}`,
          attachments,
          outputFormat: "text"
        });
        validationOutputs.push(`### ${label}\n${output}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        validationOutputs.push(`### ${label}\nUnable to complete validation: ${errorMsg}`);
      }
    }

    if (validationOutputs.length > 0) {
      finalOutput += `\n## Additional Validation Backends\n\n${validationOutputs.join("\n\n")}\n`;
    }
  }

  onProgress?.(`✨ Feature design workflow completed: ${successfulPhases}/${totalPhases} phases successful`);

  return formatWorkflowOutput(
    `Feature Design: ${featureDescription}`,
    finalOutput,
    metadata
  );
}

/**
 * Definition of feature-design workflow
 */
export const featureDesignWorkflow: WorkflowDefinition = {
  name: 'feature-design',
  description: "Orchestrates ArchitectAgent, ImplementerAgent, and TesterAgent to design, implement, and test a new feature end-to-end",
  schema: featureDesignSchema,
  execute: executeFeatureDesign
};
