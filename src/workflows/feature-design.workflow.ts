import { z } from "zod";
import { formatWorkflowOutput } from "./utils.js";
import { AutonomyLevel } from "../utils/security/permissionManager.js";
import { executeAIClient } from "../services/ai-executor.js";
import { getRoleBackend } from "../config/config.js";
import { selectOptimalBackend, createTaskCharacteristics } from "./model-selector.js";
import { getDependencies } from '../dependencies.js';
import { sanitizeUserInput } from '../utils/security/inputSanitizer.js';
import type {
  WorkflowDefinition,
  ProgressCallback
} from "../domain/workflows/types.js";

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

// ============================================================================
// Prompt builders (inlined from deleted agent classes)
// ============================================================================

function buildArchitectPrompt(
  task: string,
  focus: string,
  context?: string,
  files?: string[]
): string {
  const focusInstructions: Record<string, string> = {
    design: `Focus on:\n- System architecture and component design\n- Design patterns and best practices\n- Component boundaries and responsibilities\n- API design and contracts\n- Data flow and state management\n- Separation of concerns\n- SOLID principles application`,
    refactoring: `Focus on:\n- Code structure improvements\n- Pattern application opportunities\n- Coupling and cohesion analysis\n- Maintainability enhancements\n- Technical debt reduction\n- Code smells identification\n- Refactoring strategies and priorities`,
    optimization: `Focus on:\n- Performance bottlenecks identification\n- Algorithmic efficiency improvements\n- Resource utilization optimization\n- Caching strategies\n- Database query optimization\n- Scalability improvements\n- Load testing considerations`,
    security: `Focus on:\n- Security vulnerabilities (OWASP Top 10)\n- Authentication and authorization mechanisms\n- Data protection and encryption\n- Input validation and sanitization\n- Secure communication protocols\n- Security best practices\n- Threat modeling`,
    scalability: `Focus on:\n- Horizontal and vertical scaling strategies\n- Load distribution and balancing\n- Database scalability patterns\n- Caching and CDN usage\n- Microservices architecture considerations\n- Queue systems and async processing\n- Performance under load`
  };

  let prompt = `You are an expert Software Architect with deep knowledge of design patterns, system architecture, and software engineering best practices.\n\n`;
  prompt += `## Task\n${task}\n\n`;
  if (context) prompt += `## Context\n${context}\n\n`;
  if (files && files.length > 0) prompt += `## Files to Consider\n${files.map(f => `- ${f}`).join("\n")}\n\n`;
  prompt += `## Focus Area: ${focus}\n${focusInstructions[focus] ?? focusInstructions.design}\n\n`;
  prompt += `## Required Output Format\n\nPlease provide your analysis in the following structure:\n\n### 1. Architectural Analysis\n[Detailed analysis of the current or proposed architecture]\n\n### 2. Recommendations\n[List of specific, actionable recommendations]\n1. [Recommendation 1]\n2. [Recommendation 2]\n...\n\n### 3. Implementation Plan\n[Step-by-step plan for implementing recommendations]\n1. [Step 1]\n2. [Step 2]\n...\n\n### 4. Risks and Mitigations\n[Potential risks and how to mitigate them]\n- Risk: [Description]\n  Mitigation: [Strategy]\n\n### 5. Complexity Estimate\n[Overall complexity: LOW/MEDIUM/HIGH]\n\nBe specific, provide examples, and think about long-term implications.`;
  return prompt;
}

function buildImplementerPrompt(
  task: string,
  targetFiles: string[],
  approach: string,
  codeContext?: string
): string {
  const approachInstructions: Record<string, string> = {
    incremental: `**Incremental Implementation**\n- Make small, testable changes\n- Preserve existing functionality\n- Add features step-by-step\n- Ensure backward compatibility\n- Allow for easy rollback if needed`,
    "full-rewrite": `**Full Rewrite**\n- Start from scratch with new implementation\n- Apply modern best practices and patterns\n- Improve architecture and design\n- Ensure feature parity with existing code\n- Document breaking changes clearly`,
    minimal: `**Minimal Changes**\n- Make only necessary modifications\n- Preserve existing code structure\n- Focus on the specific issue only\n- Minimize code churn and side effects\n- Keep changes localized and focused`
  };

  let prompt = `You are an expert Code Implementer. Your task is to generate production-ready code with proper error handling, documentation, and best practices.\n\n`;
  prompt += `## Task\n${task}\n\n`;
  prompt += `## Target Files\n${targetFiles.map(f => `- ${f}`).join("\n")}\n\n`;
  if (codeContext) prompt += `## Code Context\n\`\`\`\n${codeContext}\n\`\`\`\n\n`;
  prompt += `## Implementation Approach\n${approachInstructions[approach] ?? approachInstructions.incremental}\n\n`;
  prompt += `## Requirements\n\nYour implementation MUST:\n1. Be production-ready and follow best practices\n2. Include comprehensive error handling\n3. Be well-documented with clear comments\n4. Be testable and maintainable\n5. Handle edge cases appropriately\n6. Follow the project's coding style and conventions\n\n## Output Format\n\nPlease provide your implementation in this structure:\n\n### Summary\n[Brief description of what was implemented and why]\n\n### Changed Files\n\nFor each file that needs modification:\n\n**File: \`filename.ts\`**\nDescription: [What changes were made]\n\n\`\`\`typescript\n[Complete code implementation or snippet]\n\`\`\`\n\n### Test Suggestions\n[How to test this implementation]\n1. [Test case 1]\n2. [Test case 2]\n...\n\n### Next Steps\n[What should be done after this implementation]\n1. [Step 1]\n2. [Step 2]\n...`;
  return prompt;
}

function buildTesterPrompt(
  featureDescription: string,
  targetFiles: string[],
  testType: string
): string {
  const testTypeInstructions: Record<string, string> = {
    unit: `**Unit Test Focus:**\n- Test individual functions/methods in isolation\n- Mock external dependencies and modules\n- Cover all code paths and branches\n- Test return values and side effects\n- Verify error handling and edge cases\n- Use descriptive test names (describe/it structure)\n- Keep tests fast and independent`,
    integration: `**Integration Test Focus:**\n- Test component interactions\n- Use real dependencies where practical\n- Test data flow between components\n- Verify API contracts and interfaces\n- Test error propagation between layers\n- Include realistic scenarios\n- May be slower than unit tests`,
    e2e: `**End-to-End Test Focus:**\n- Test complete user flows\n- Use realistic user scenarios\n- Test from user perspective (UI to database)\n- Verify business requirements\n- Include setup and cleanup\n- May require test data fixtures\n- Focus on critical user paths`
  };

  let prompt = `You are an expert Test Engineer specializing in comprehensive test generation.\n\n`;
  prompt += `## Target Code\n\`\`\`typescript\n// Feature: ${featureDescription}\n// Files: ${targetFiles.join(", ")}\n\`\`\`\n\n`;
  prompt += `## Test Requirements\n- Test Type: ${testType}\n- Framework: jest\n- Coverage Goal: 80%\n\n`;
  prompt += `## Test Focus\n${testTypeInstructions[testType] ?? testTypeInstructions.unit}\n\n`;
  prompt += `## Output Format\n\nPlease provide your test implementation in this structure:\n\n### Test Code\n\n\`\`\`typescript\n[Complete test code with imports and proper jest syntax]\n\`\`\`\n\n### Test Coverage Analysis\n- Estimated Coverage: [percentage]%\n- Test Count: [number]\n- Covered Scenarios:\n  1. [Scenario 1]\n  2. [Scenario 2]\n  ...\n\n### Recommendations\n[Suggestions for additional tests or improvements]\n1. [Recommendation 1]\n2. [Recommendation 2]\n...\n\n## Requirements\n\nYour tests MUST include:\n1. **Happy path tests** - Normal expected behavior\n2. **Edge case tests** - Boundary conditions\n3. **Error handling tests** - Invalid inputs and failures\n4. **Descriptive test names** - Clear what is being tested\n5. **Proper assertions** - Verify expected outcomes\n6. **Setup/teardown** - If needed for test isolation\n\nWrite idiomatic jest tests with clear arrange-act-assert pattern.`;
  return prompt;
}

// Format a phase result to match the previous formatAgentResults() output
function formatPhaseResult(agentName: string, success: boolean, backend: string, durationMs: number, autonomyLevel: string, extraMeta: Record<string, unknown>, output: string, error?: string): string {
  let out = `# ${agentName} Results\n\n`;
  out += `**Status:** ${success ? "✅ SUCCESS" : "❌ FAILED"}\n\n`;
  out += `## Metadata\n\n`;
  out += `- **Backend:** ${backend}\n`;
  out += `- **Execution Time:** ${durationMs}ms\n`;
  out += `- **Autonomy Level:** ${autonomyLevel}\n`;
  for (const [k, v] of Object.entries(extraMeta)) {
    out += `- **${k}:** ${JSON.stringify(v)}\n`;
  }
  out += "\n";
  if (!success && error) {
    out += `## Error\n\n\`\`\`\n${error}\n\`\`\`\n\n`;
  }
  out += `## Output\n\n${output}`;
  return out;
}

// ============================================================================
// Main workflow
// ============================================================================

export async function executeFeatureDesign(
  params: FeatureDesignParams,
  onProgress?: ProgressCallback
): Promise<string> {
  const {
    featureDescription: rawFeatureDescription,
    targetFiles,
    context,
    architecturalFocus,
    implementationApproach,
    testType,
    validationBackends = [],
    attachments = []
  } = params;
  const featureDescription = sanitizeUserInput(rawFeatureDescription);
  const autonomyLevel = params.autonomyLevel || AutonomyLevel.READ_ONLY;

  onProgress?.(`🎯 Starting feature design workflow for: ${featureDescription}`);

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
  // PHASE 1: Architectural Design
  // ============================================================================

  try {
    onProgress?.("📐 Phase 1: Architectural Analysis and Design");

    const archTask = createTaskCharacteristics('architecture');
    archTask.requiresArchitecturalThinking = true;
    const archBackend = await selectOptimalBackend(archTask, circuitBreaker);

    const archStart = Date.now();
    let archOutput = "";
    let archSuccess = false;
    let archError: string | undefined;

    try {
      archOutput = await executeAIClient({
        backend: archBackend,
        prompt: buildArchitectPrompt(
          `Design the architecture for the following feature:\n\n${featureDescription}`,
          architecturalFocus ?? "design",
          context,
          targetFiles
        )
      });
      archSuccess = true;
    } catch (err) {
      archError = err instanceof Error ? err.message : String(err);
    }

    const archDuration = Date.now() - archStart;

    finalOutput += formatPhaseResult(
      "ArchitectAgent",
      archSuccess,
      archBackend,
      archDuration,
      autonomyLevel,
      { focus: architecturalFocus ?? "design", filesAnalyzed: targetFiles.length },
      archOutput,
      archError
    );
    finalOutput += "\n\n---\n\n";

    metadata.phases.push({
      phase: "architecture",
      success: archSuccess,
      backend: archBackend,
      executionTime: archDuration
    });

    onProgress?.(archSuccess ? "✅ Architecture phase completed successfully" : "⚠️ Architecture phase failed, continuing with implementation...");

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onProgress?.(`❌ Architecture phase error: ${errorMsg}`);
    finalOutput += `## ⚠️ Architecture Phase Error\n\n${errorMsg}\n\n---\n\n`;
  }

  // ============================================================================
  // PHASE 2: Code Implementation
  // ============================================================================

  try {
    onProgress?.("💻 Phase 2: Code Implementation");

    const implTask = createTaskCharacteristics('implementation');
    implTask.requiresCodeGeneration = true;
    const implBackend = await selectOptimalBackend(implTask, circuitBreaker);

    const implStart = Date.now();
    let implOutput = "";
    let implSuccess = false;
    let implError: string | undefined;

    try {
      implOutput = await executeAIClient({
        backend: implBackend,
        prompt: buildImplementerPrompt(
          featureDescription,
          targetFiles,
          implementationApproach ?? "incremental",
          context
        )
      });
      implSuccess = true;
    } catch (err) {
      implError = err instanceof Error ? err.message : String(err);
    }

    const implDuration = Date.now() - implStart;

    finalOutput += formatPhaseResult(
      "ImplementerAgent",
      implSuccess,
      implBackend,
      implDuration,
      autonomyLevel,
      { approach: implementationApproach ?? "incremental", targetFilesCount: targetFiles.length },
      implOutput,
      implError
    );
    finalOutput += "\n\n---\n\n";

    metadata.phases.push({
      phase: "implementation",
      success: implSuccess,
      backend: implBackend,
      executionTime: implDuration,
      changedFiles: 0
    });

    if (!implSuccess) {
      onProgress?.("⚠️ Implementation phase failed, continuing with tests...");
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        finalOutput += `\n## Implementer Fallback Suggestions\n\nUnable to generate suggestions: ${msg}\n\n---\n\n`;
      }
    } else {
      onProgress?.("✅ Implementation phase completed successfully");
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onProgress?.(`❌ Implementation phase error: ${errorMsg}`);
    finalOutput += `## ⚠️ Implementation Phase Error\n\n${errorMsg}\n\n---\n\n`;
  }

  // ============================================================================
  // PHASE 3: Test Generation
  // ============================================================================

  try {
    onProgress?.("🧪 Phase 3: Test Generation");

    const testTask = createTaskCharacteristics('testing');
    testTask.requiresSpeed = true;
    const testBackend = await selectOptimalBackend(testTask, circuitBreaker);

    const testStart = Date.now();
    let testOutput = "";
    let testSuccess = false;
    let testError: string | undefined;

    try {
      testOutput = await executeAIClient({
        backend: testBackend,
        prompt: buildTesterPrompt(featureDescription, targetFiles, testType ?? "unit")
      });
      testSuccess = true;
    } catch (err) {
      testError = err instanceof Error ? err.message : String(err);
    }

    const testDuration = Date.now() - testStart;

    finalOutput += formatPhaseResult(
      "TesterAgent",
      testSuccess,
      testBackend,
      testDuration,
      autonomyLevel,
      { testType: testType ?? "unit", framework: "jest", coverageGoal: 80 },
      testOutput,
      testError
    );
    finalOutput += "\n\n---\n\n";

    metadata.phases.push({
      phase: "testing",
      success: testSuccess,
      backend: testBackend,
      executionTime: testDuration,
      testCount: 0,
      coverage: 0
    });

    onProgress?.(testSuccess ? "✅ Test generation phase completed successfully" : "⚠️ Test generation phase failed");

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
      try {
        const isArchitect = backend === archRole;
        const output = await executeAIClient({
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

export const featureDesignWorkflow: WorkflowDefinition = {
  name: 'feature-design',
  description: "Orchestrates architecture, implementation, and test generation to design a new feature end-to-end",
  schema: featureDesignSchema,
  execute: executeFeatureDesign
};
