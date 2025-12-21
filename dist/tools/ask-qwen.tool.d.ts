import { z } from "zod";
import type { UnifiedTool } from "./registry.js";
declare const askQwenSchema: z.ZodObject<{
    prompt: z.ZodString;
    outputFormat: z.ZodDefault<z.ZodEnum<["text", "json"]>>;
    sandbox: z.ZodDefault<z.ZodBoolean>;
    yolo: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    yolo: boolean;
    prompt: string;
    sandbox: boolean;
    outputFormat: "json" | "text";
}, {
    prompt: string;
    yolo?: boolean | undefined;
    sandbox?: boolean | undefined;
    outputFormat?: "json" | "text" | undefined;
}>;
export type AskQwenParams = z.infer<typeof askQwenSchema>;
export declare const askQwenTool: UnifiedTool;
export {};
//# sourceMappingURL=ask-qwen.tool.d.ts.map