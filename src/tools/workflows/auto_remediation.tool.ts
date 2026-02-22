import { UnifiedTool, ToolExecutionContext } from "../registry.js";
import { autoRemediationWorkflow } from "../../workflows/auto-remediation.workflow.js";

export const workflowAutoRemediationTool: UnifiedTool = {
    name: "workflow_auto_remediation",
    description: `
⚠️ BEFORE INVOKING: Ask the user which autonomyLevel they want (auto / read-only / low / medium / high). Do NOT call this tool without asking first.

# Auto Remediation

Generates an autonomous remediation plan using Factory Droid.

This workflow:
1. **Analyzes** the symptoms and context.
2. **Generates** a step-by-step operational plan.
3. **Defines** verification steps and residual risks.

## Usage
Use when you need a concrete, executable plan to fix a known issue or implement a recovery strategy.
  `.trim(),
    zodSchema: autoRemediationWorkflow.schema as any,
    category: "workflow",
    metadata: {
        category: "debugging",
        bestFor: [
            "Creating operational runbooks",
            "Automated recovery planning",
            "Incident response"
        ],
        notFor: [
            "Exploratory debugging",
            "Architectural design"
        ],
        cost: "medium",
        duration: "30s",
        backends: ["ask-droid"]
    },
    examples: [
        {
            scenario: "Fix Memory Leak",
            params: {
                symptoms: "Memory usage spikes to 2GB then crashes",
                maxActions: 5
            }
        }
    ],
    execute: async (args: Record<string, any>, context: ToolExecutionContext) => {
        return await autoRemediationWorkflow.execute(args, context.onProgress);
    }
};
