import { BACKENDS, normalizeBackendName } from "../constants.js";

// Re-export BACKENDS for convenience
export { BACKENDS };
import { executeCommand } from "../utils/cli/commandExecutor.js";
import { logger } from "../utils/logger.js";
import { BackendRegistry } from "../backends/backend-registry.js";
import { BackendExecutionOptions } from "../backends/types.js";
import { getDependencies } from "../dependencies.js";
import { selectFallbackBackend } from "../workflows/model-selector.js";
import { validateFilePaths } from "../utils/security/pathValidator.js";

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
 * Transform options for a target backend based on its capabilities.
 * Handles semantic differences between backends (e.g., how files are passed).
 * @internal Exported for testing
 */
export function transformOptionsForBackend(
  options: AIExecutionOptions,
  targetBackend: string
): AIExecutionOptions {
  const registry = BackendRegistry.getInstance();
  const executor = registry.getBackend(targetBackend);

  if (!executor) {
    // Can't transform without executor info, return as-is
    return { ...options, backend: targetBackend };
  }

  const capabilities = executor.getCapabilities();
  const { attachments = [], prompt, ...rest } = options;

  // Transform autonomy params based on backend type
  const normalizedBackend = normalizeBackendName(targetBackend);
  let result = rest;
  if (normalizedBackend === normalizeBackendName(BACKENDS.DROID)) {
    // Droid uses 'auto' field, remove 'autoApprove'
    const { autoApprove: _aa, auto, ...droidRest } = rest;
    const transformedAuto = (_aa ?? false) ? "high" : (auto ?? "low");
    result = { ...droidRest, auto: transformedAuto };
  } else if (
    normalizedBackend === normalizeBackendName(BACKENDS.CURSOR) ||
    normalizedBackend === normalizeBackendName(BACKENDS.ROVODEV) ||
    normalizedBackend === normalizeBackendName(BACKENDS.QWEN)
  ) {
    // Cursor/RovoDev/Qwen use 'autoApprove' field, remove 'auto'
    const { auto, autoApprove, ...cursorRest } = rest;
    // Only transform autoApprove if auto is present, otherwise preserve existing autoApprove
    const transformedAutoApprove = auto !== undefined ? (auto === "high") : (autoApprove ?? false);
    result = { ...cursorRest, autoApprove: transformedAutoApprove };
  } else if (normalizedBackend === normalizeBackendName(BACKENDS.GEMINI)) {
    // Gemini doesn't support autonomy params, remove both
    const { auto: _a, autoApprove: _aa, ...geminiRest } = rest;
    result = { ...geminiRest };
  }

  // If target backend doesn't support files via CLI flag but has attachments,
  // we need to handle them based on fileMode
  if (attachments.length > 0) {
    if (capabilities.fileMode === 'embed-in-prompt') {
      // SECURITY: Validate paths before embedding in prompt
      const validatedPaths = validateFilePaths(attachments);
      // Embed file references in prompt, clear attachments
      const fileList = validatedPaths.join(', ');
      const transformedPrompt = `[Files to analyze: ${fileList}]\n\n${prompt}`;
      logger.debug(`Transformed attachments to embedded prompt for backend ${targetBackend}`);
      return {
        ...result,
        prompt: transformedPrompt,
        attachments: [], // Clear attachments since they're now in prompt
        backend: targetBackend
      };
    } else if (capabilities.fileMode === 'none') {
      // SECURITY: Validate paths before embedding in prompt
      const validatedPaths = validateFilePaths(attachments);
      // Backend doesn't support files at all, embed in prompt as best effort
      const fileList = validatedPaths.join(', ');
      const transformedPrompt = `[Files to analyze: ${fileList}]\n\n${prompt}`;
      logger.warn(`Backend ${targetBackend} doesn't support files, embedding in prompt as fallback`);
      return {
        ...result,
        prompt: transformedPrompt,
        attachments: [], // Clear attachments
        backend: targetBackend
      };
    }
    // fileMode === 'cli-flag': pass attachments as-is (backend handles via --file)
  }

  return { ...result, attachments, prompt, backend: targetBackend };
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

  const transformedOpts = transformOptionsForBackend(options, backend);
  const { backend: _b, ...transformedRest } = transformedOpts;

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
  if (!circuitBreaker.get(backend).isAvailable()) {
    logger.warn(`Backend ${backend} is currently unavailable (Circuit Open).`);

    if (config.currentRetry < config.maxRetries) {
      const fallback = await selectFallbackBackend(backend, circuitBreaker, config.triedBackends);
      const transformedOptions = transformOptionsForBackend(options, fallback);

      logger.info(`Trying fallback backend: ${fallback}`);
      // Pass transformed options to avoid re-transformation on subsequent fallbacks
      return executeAIClient(
        transformedOptions,
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

    const result = await executor.execute(transformedRest);

    // Report success to Circuit Breaker
    circuitBreaker.get(backend).onSuccess();
    success = true;

    // Log successful fallback if this wasn't the first try
    if (config.currentRetry > 0) {
      logger.info(`Successfully completed with fallback backend ${backend} after ${config.currentRetry} retries.`);
    }

    return result;

  } catch (error) {
    // Report failure to Circuit Breaker
    circuitBreaker.get(backend).onFailure(backend);
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
      const transformedOptions = transformOptionsForBackend(options, fallback);

      logger.info(`Retrying with fallback backend: ${fallback} (attempt ${config.currentRetry + 1}/${config.maxRetries})`);
      // Pass transformed options to avoid re-transformation on subsequent fallbacks
      return executeAIClient(
        transformedOptions,
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
