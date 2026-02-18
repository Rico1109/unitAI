/**
 * Live backend-routing verification script.
 * Reads the real ~/.unitai/config.json and shows which backend
 * selectOptimalBackend() picks for each workflow type.
 *
 * Usage: node_modules/.bin/tsx scripts/verify-routing.mts
 */
import { getRoleBackend, loadConfig, invalidateConfigCache } from '../src/config/config.js';
import { selectOptimalBackend, createTaskCharacteristics } from '../src/workflows/model-selector.js';

const cb = { isAvailable: async () => true, onSuccess: () => {}, onFailure: () => {} };

async function main() {
  invalidateConfigCache();
  const cfg = loadConfig();

  console.log('\n=== Current config roles ===');
  if (cfg) {
    console.log(`  architect   → ${cfg.roles.architect}`);
    console.log(`  implementer → ${cfg.roles.implementer}`);
    console.log(`  tester      → ${cfg.roles.tester}`);
    console.log(`  enabled     : ${cfg.backends.enabled.join(', ')}`);
    console.log(`  fallback    : ${cfg.fallbackPriority?.join(' → ') ?? '(default)'}`);
  } else {
    console.log('  (no config — built-in defaults apply)');
    console.log('  architect   → ask-gemini');
    console.log('  implementer → ask-droid');
    console.log('  tester      → ask-qwen');
  }

  const workflows = [
    { label: 'parallel-review  (requiresArchitecturalThinking)', name: 'parallel-review' },
    { label: 'feature-design   (requiresArchitecturalThinking)', name: 'feature-design' },
    { label: 'auto-remediation (requiresCodeGeneration)        ', name: 'auto-remediation' },
    { label: 'bug-hunt         (domain=debugging → tester)     ', name: 'bug-hunt' },
    { label: 'pre-commit       (requiresSpeed → tester)        ', name: 'pre-commit-validate' },
  ];

  console.log('\n=== selectOptimalBackend() per workflow ===');
  for (const { label, name } of workflows) {
    const task = createTaskCharacteristics(name);
    const selected = await selectOptimalBackend(task, cb as any);
    const role =
      task.requiresArchitecturalThinking ? 'architect'
      : task.requiresCodeGeneration && !task.requiresSpeed ? 'implementer'
      : 'tester';
    const expected = getRoleBackend(role);
    const match = selected === expected ? '✓' : '✗ MISMATCH';
    console.log(`  ${label} → ${selected}  [role:${role}, expected:${expected}] ${match}`);
  }
  console.log('');
}

main().catch(console.error);
