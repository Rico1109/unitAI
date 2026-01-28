import { z } from "zod";
import { BACKENDS, ERROR_MESSAGES } from "../constants.js";
import { executeAIClient } from "../utils/aiExecutor.js";
const askQwenSchema = z.object({
    prompt: z
        .string()
        .min(1)
        .describe("Prompt for Qwen CLI"),
    outputFormat: z
        .enum(["text", "json"])
        .default("text")
        .describe("Output format (text/json)"),
    sandbox: z
        .boolean()
        .default(false)
        .describe("Sandbox mode (-s)"),
    yolo: z
        .boolean()
        .default(false)
        .describe("Auto-approve execution (YOLO mode)")
});
export const askQwenTool = {
    name: "ask-qwen",
    description: "Query Qwen via the qwen CLI with support for sandbox and YOLO mode",
    category: "ai-client",
    zodSchema: askQwenSchema,
    execute: async (args, context) => {
        const { prompt, outputFormat, sandbox, yolo } = args;
        const { onProgress } = context;
        if (!prompt || !prompt.trim()) {
            throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
        }
        return executeAIClient({
            backend: BACKENDS.QWEN,
            prompt,
            outputFormat,
            sandbox,
            autoApprove: yolo,
            onProgress
        });
    },
    prompt: {
        name: "ask-qwen",
        description: "Query Qwen CLI",
        arguments: [
            {
                name: "prompt",
                description: "Prompt to execute",
                required: true
            },
            {
                name: "outputFormat",
                description: "Format (text/json)",
                required: false
            },
            {
                name: "sandbox",
                description: "Sandbox mode active",
                required: false
            },
            {
                name: "yolo",
                description: "YOLO mode (auto-approve)",
                required: false
            }
        ]
    }
};
//# sourceMappingURL=ask-qwen.tool.js.map