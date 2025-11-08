#!/usr/bin/env node

/**
 * Simple script to run the init-session workflow
 */

import { initSessionWorkflow } from './dist/workflows/init-session.workflow.js';

async function main() {
  console.log('🚀 Starting init-session workflow...\n');

  try {
    const result = await initSessionWorkflow.execute(
      { autonomyLevel: 'read-only' },
      (progress) => console.log(`📍 ${progress}`)
    );

    console.log('\n✅ Workflow completed!\n');
    console.log('━'.repeat(80));
    console.log(result);
    console.log('━'.repeat(80));
  } catch (error) {
    console.error('\n❌ Workflow failed:');
    console.error(error);
    process.exit(1);
  }
}

main();
