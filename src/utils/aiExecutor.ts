import { BACKENDS } from "../constants.js";

// Re-export BACKENDS for convenience
export { BACKENDS };
import { executeCommand } from "./cli/commandExecutor.js";
import { logger } from "./logger.js";
import { BackendRegistry } from "../backends/BackendRegistry.js";
import { BackendExecutionOptions } from "../backends/types.js";
import { getDependencies } from "../dependencies.js";
import { selectFallbackBackend } from "../workflows/modelSelector.js";

/**
 * Options for executing AI CLI commands
 */
export interface AIExecutionOptions extends BackendExecutionOptions {
  backend: string;
}

/**
 * Execute a simple command (like echo or help)
 */
export async function executeSimpleCommand(
  command: string,
  args: string[] = []
): Promise<string> {
  logger.debug(`Executing simple command: ${command} ${args.join(" ")}`);
  return executeCommand(command, args);
}

/**
 * Configuration for retry-with-fallback behavior
 */
export interface RetryConfig {
  maxRetries: number;
  currentRetry: number;
  triedBackends: string[];
}

/**
 * Main function to execute an AI command based on backend
 * Includes automatic retry-with-fallback when a backend fails
 * WITH RED METRICS TRACKING
 */
export async function executeAIClient(
  options: AIExecutionOptions,
  retryConfig?: RetryConfig
): Promise<string> {
  const { backend, ...rest } = options;
  const { circuitBreaker, metricsDb } = getDependencies();
  const registry = BackendRegistry.getInstance();

  // Import MetricsRepository dynamically to avoid circular deps
  const { MetricsRepository } = await import('../repositories/metrics.js');
  const metricsRepo = new MetricsRepository(metricsDb);

  // Start timing for RED metrics
  const startTime = Date.now();
  let success = false;
  let errorType: string | undefined;

  // Initialize retry config
  const config: RetryConfig = retryConfig || {
    maxRetries: 2,
    currentRetry: 0,
    triedBackends: []
  };

  // Track this backend as tried
  config.triedBackends.push(backend);

  // Circuit Breaker Check - try fallback if blocked
  if (!(await circuitBreaker.isAvailable(backend))) {
    logger.warn(`Backend ${backend} is currently unavailable (Circuit Open).`);

    if (config.currentRetry < config.maxRetries) {
      const fallback = await selectFallbackBackend(backend, circuitBreaker, config.triedBackends);

      logger.info(`Trying fallback backend: ${fallback}`);
      return executeAIClient(
        { ...options, backend: fallback },
        { ...config, currentRetry: config.currentRetry + 1 }
      );
    }

    throw new Error(`Backend ${backend} unavailable and max retries (${config.maxRetries}) exhausted.`);
  }

  try {
    const executor = registry.getBackend(backend);
    if (!executor) {
      throw new Error(`Unsupported backend: ${backend}`);
    }

    const result = await executor.execute(rest);

    // Report success to Circuit Breaker
    circuitBreaker.onSuccess(backend);
    success = true;

    // Log successful fallback if this wasn't the first try
    if (config.currentRetry > 0) {
      logger.info(`Successfully completed with fallback backend ${backend} after ${config.currentRetry} retries.`);
    }

    return result;

  } catch (error) {
    // Report failure to Circuit Breaker
    circuitBreaker.onFailure(backend);
    success = false;
    errorType = error instanceof Error ? error.name : 'UnknownError';

    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`Backend ${backend} failed: ${errorMsg}`);

    // Don't retry for configuration errors (unsupported backend)
    if (errorMsg.includes('Unsupported backend')) {
      throw error;
    }

    // Retry with fallback if we haven't exhausted retries
    if (config.currentRetry < config.maxRetries) {
      const fallback = await selectFallbackBackend(backend, circuitBreaker, config.triedBackends);

      logger.info(`Retrying with fallback backend: ${fallback} (attempt ${config.currentRetry + 1}/${config.maxRetries})`);
      return executeAIClient(
        { ...options, backend: fallback },
        { ...config, currentRetry: config.currentRetry + 1 }
      );
    }

    // All retries exhausted
    logger.error(`All ${config.maxRetries} retry attempts exhausted. Backends tried: ${config.triedBackends.join(', ')}`);
    throw error;
  } finally {
    // Record RED metric (Rate, Errors, Duration)
    const duration = Date.now() - startTime;

    try {
      metricsRepo.record({
        metricType: 'request',
        component: 'ai-executor',
        backend,
        duration,
        success,
        errorType,
        requestId: options.requestId,
        metadata: {
          retryCount: config.currentRetry,
          triedBackends: config.triedBackends
        }
      });
    } catch (metricsError) {
      // Don't fail the request if metrics recording fails
      logger.warn('Failed to record RED metric', metricsError);
    }
  }
}
