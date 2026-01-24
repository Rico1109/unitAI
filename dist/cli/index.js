#!/usr/bin/env node
/**
 * unitAI CLI Entry Point
 *
 * Routes to different subcommands:
 * - unitai setup  - Run setup wizard
 * - unitai health - Run health check
 * - unitai        - Start MCP server (default)
 */
import { runSetupWizard } from './setup.js';
import { runHealthCheck } from './health.js';
const args = process.argv.slice(2);
const command = args[0];
async function main() {
    switch (command) {
        case 'setup':
            runSetupWizard();
            break;
        case 'health':
            await runHealthCheck();
            break;
        case '--help':
        case '-h':
            console.log(`
unitAI - Unified AI Orchestration via MCP

Usage:
  unitai           Start the MCP server
  unitai setup     Run the setup wizard
  unitai health    Quick health check

Options:
  --help, -h      Show this help message
  --version, -v   Show version
`);
            break;
        case '--version':
        case '-v':
            console.log('unitAI v0.3.0');
            break;
        default:
            // No subcommand = start MCP server
            // Import dynamically to avoid loading MCP deps for subcommands
            const { startServer } = await import('../index.js');
            startServer();
            break;
    }
}
main().catch(console.error);
//# sourceMappingURL=index.js.map