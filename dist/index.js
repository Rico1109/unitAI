#!/usr/bin/env node
/**
 * Unified AI MCP Tool - Model Context Protocol server for multiple AI clients
 *
 * This server enables AI assistants like Claude to interact with multiple
 * AI coding assistants (Gemini, Cursor Agent, Droid) through the Model Context Protocol.
 */
import { UnitAIServer } from "./server.js";
import { logger } from "./utils/logger.js";
/**
 * Start the server
 */
export async function startServer() {
    logger.info("Starting Unified AI MCP Tool server...");
    const server = new UnitAIServer();
    await server.start();
}
// Run the server if executed directly (not via CLI)
// Check if this file is the entry point
const isDirectExecution = process.argv[1]?.endsWith('index.js') &&
    !process.argv[1]?.includes('/cli/');
if (isDirectExecution) {
    startServer().catch((error) => {
        logger.error(`Fatal error: ${error}`);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map