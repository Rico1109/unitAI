#!/usr/bin/env tsx
/**
 * Reset Circuit Breaker
 *
 * Utility script to reset circuit breaker states during development
 */

import { initializeDependencies, closeDependencies } from '../src/dependencies.js';

// Initialize dependencies
const deps = initializeDependencies();

console.log('Current circuit breaker states:');
const states = deps.circuitBreaker.getStates();
for (const [backend, state] of states.entries()) {
    console.log(`  ${backend}: ${state.state} (failures: ${state.failures})`);
}

if (states.size === 0) {
    console.log('  (no backends tracked yet)');
}

console.log('\nResetting circuit breaker...');
deps.circuitBreaker.reset();

console.log('✅ Circuit breaker reset complete!');
console.log('All backends are now available for requests.');

// Clean up
closeDependencies();
