/**
 * Integration tests for server.ts
 *
 * LIFECYCLE: Tests server lifecycle, signal handlers, graceful shutdown
 * Target Coverage: 85%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    progress: vi.fn(),
  },
}));

// Mock dependencies
const mockCloseDependencies = vi.fn();
const mockInitializeDependencies = vi.fn(() => ({
  activityDb: {},
  auditDb: {},
  tokenDb: {},
  circuitBreaker: {},
}));

vi.mock('../../src/dependencies.js', () => ({
  initializeDependencies: mockInitializeDependencies,
  closeDependencies: mockCloseDependencies,
}));

// Mock MCP SDK
const mockConnect = vi.fn();
const mockSetRequestHandler = vi.fn();
const mockServer = {
  connect: mockConnect,
  setRequestHandler: mockSetRequestHandler,
};

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn(() => mockServer),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

// Mock tools
const mockGetToolDefinitions = vi.fn(() => [
  { name: 'test-tool', description: 'Test tool' },
]);
const mockExecuteTool = vi.fn(async () => 'success');
const mockToolExists = vi.fn(() => true);

vi.mock('../../src/tools/index.js', () => ({
  getToolDefinitions: mockGetToolDefinitions,
  executeTool: mockExecuteTool,
  toolExists: mockToolExists,
}));

// Mock constants
vi.mock('../../src/constants.js', () => ({
  MCP_CONFIG: {
    SERVER_NAME: 'unitai-test',
    VERSION: '1.0.0',
    CAPABILITIES: {},
  },
}));

describe('server', () => {
  let UnitAIServer: any;
  let processExitSpy: any;
  let processOnSpy: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Spy on process.exit
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    // Spy on process.on for signal handlers
    processOnSpy = vi.spyOn(process, 'on');

    // Import server after mocks are set up
    vi.resetModules();
    const serverModule = await import('../../src/server.js');
    UnitAIServer = serverModule.UnitAIServer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =================================================================
  // Suite 1: Server Initialization
  // =================================================================
  describe('Server Initialization', () => {
    it('should initialize dependencies on construction', () => {
      // Act
      new UnitAIServer();

      // Assert
      expect(mockInitializeDependencies).toHaveBeenCalled();
    });

    it('should create MCP Server with config', async () => {
      // Arrange
      const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');

      // Act
      new UnitAIServer();

      // Assert
      expect(Server).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'unitai-test',
          version: '1.0.0',
        }),
        expect.objectContaining({
          capabilities: expect.any(Object),
        })
      );
    });

    it('should setup request handlers', () => {
      // Act
      new UnitAIServer();

      // Assert: Should have set up 2 handlers (ListTools, CallTool)
      expect(mockSetRequestHandler).toHaveBeenCalledTimes(2);
    });
  });

  // =================================================================
  // Suite 2: Request Handlers
  // =================================================================
  describe('Request Handlers', () => {
    it('should handle ListTools request', async () => {
      // Arrange
      new UnitAIServer();

      // Find the ListTools handler (first call)
      const listToolsCall = mockSetRequestHandler.mock.calls[0];
      expect(listToolsCall).toBeDefined();
      const listToolsHandler = listToolsCall[1];

      // Act
      const result = await listToolsHandler();

      // Assert
      expect(result).toEqual({
        tools: [{ name: 'test-tool', description: 'Test tool' }],
      });
      expect(mockGetToolDefinitions).toHaveBeenCalled();
    });

    it('should handle CallTool request for existing tool', async () => {
      // Arrange
      new UnitAIServer();

      // Find the CallTool handler (second call)
      const callToolCall = mockSetRequestHandler.mock.calls[1];
      expect(callToolCall).toBeDefined();
      const callToolHandler = callToolCall[1];

      // Act
      const result = await callToolHandler({
        params: { name: 'test-tool', arguments: { key: 'value' } },
      });

      // Assert
      expect(mockToolExists).toHaveBeenCalledWith('test-tool');
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'test-tool',
        { key: 'value' },
        expect.any(Function)
      );
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'success',
          },
        ],
      });
    });

    it('should throw error for non-existent tool', async () => {
      // Arrange
      mockToolExists.mockReturnValue(false);
      new UnitAIServer();
      const callToolHandler = mockSetRequestHandler.mock.calls[1][1];

      // Act & Assert
      await expect(
        callToolHandler({ params: { name: 'unknown-tool', arguments: {} } })
      ).rejects.toThrow("Tool 'unknown-tool' not found");
    });

    it('should handle tool execution errors', async () => {
      // Arrange
      mockExecuteTool.mockRejectedValue(new Error('Tool execution failed'));
      new UnitAIServer();
      const callToolHandler = mockSetRequestHandler.mock.calls[1][1];

      // Act & Assert
      await expect(
        callToolHandler({ params: { name: 'test-tool', arguments: {} } })
      ).rejects.toThrow('Tool execution failed');
    });

    it('should handle tool returning object result', async () => {
      // Arrange
      mockExecuteTool.mockResolvedValue({ result: 'data', status: 'ok' });
      new UnitAIServer();
      const callToolHandler = mockSetRequestHandler.mock.calls[1][1];

      // Act
      const result = await callToolHandler({
        params: { name: 'test-tool', arguments: {} },
      });

      // Assert
      expect(result.content[0].text).toBe(JSON.stringify({ result: 'data', status: 'ok' }));
    });
  });

  // =================================================================
  // Suite 3: Server Lifecycle
  // =================================================================
  describe('Server Lifecycle', () => {
    it('should start server and connect transport', async () => {
      // Arrange
      const server = new UnitAIServer();
      mockConnect.mockResolvedValue(undefined);

      // Act
      await server.start();

      // Assert
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should setup shutdown handlers after start', async () => {
      // Arrange
      const server = new UnitAIServer();
      mockConnect.mockResolvedValue(undefined);

      // Act
      await server.start();

      // Assert: Should register SIGINT and SIGTERM handlers
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should handle server start failure', async () => {
      // Arrange
      const server = new UnitAIServer();
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      // Act
      await server.start();

      // Assert
      expect(mockCloseDependencies).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should close dependencies on stop', async () => {
      // Arrange
      const server = new UnitAIServer();

      // Act
      await server.stop();

      // Assert
      expect(mockCloseDependencies).toHaveBeenCalled();
    });
  });

  // =================================================================
  // Suite 4: Signal Handlers
  // =================================================================
  describe('Signal Handlers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle SIGINT signal', async () => {
      // Arrange
      const server = new UnitAIServer();
      mockConnect.mockResolvedValue(undefined);
      await server.start();

      // Get the SIGINT handler
      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
      expect(sigintCall).toBeDefined();
      const sigintHandler = sigintCall![1];

      // Act
      const shutdownPromise = sigintHandler();
      await vi.runAllTimersAsync();

      // Assert
      expect(mockCloseDependencies).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle SIGTERM signal', async () => {
      // Arrange
      const server = new UnitAIServer();
      mockConnect.mockResolvedValue(undefined);
      await server.start();

      // Get the SIGTERM handler
      const sigtermCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGTERM');
      expect(sigtermCall).toBeDefined();
      const sigtermHandler = sigtermCall![1];

      // Act
      const shutdownPromise = sigtermHandler();
      await vi.runAllTimersAsync();

      // Assert
      expect(mockCloseDependencies).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should setup timeout for graceful shutdown', async () => {
      // Arrange
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const server = new UnitAIServer();
      mockConnect.mockResolvedValue(undefined);
      await server.start();

      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
      const sigintHandler = sigintCall![1];

      // Act
      const shutdownPromise = sigintHandler();
      await vi.runAllTimersAsync();

      // Assert: Should have set a timeout (10 seconds)
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    });

    it('should clear timeout if shutdown completes in time', async () => {
      // Arrange
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const server = new UnitAIServer();
      mockConnect.mockResolvedValue(undefined);
      await server.start();

      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
      const sigintHandler = sigintCall![1];

      // Act
      const shutdownPromise = sigintHandler();
      await vi.runAllTimersAsync();

      // Assert: Timeout should be cleared
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should attempt to close dependencies even if it fails', async () => {
      // Arrange
      mockCloseDependencies.mockImplementation(() => {
        throw new Error('Shutdown error');
      });
      const server = new UnitAIServer();
      mockConnect.mockResolvedValue(undefined);
      await server.start();

      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
      const sigintHandler = sigintCall![1];

      // Act
      const shutdownPromise = sigintHandler();
      await vi.runAllTimersAsync();

      // Assert: closeDependencies should be called despite the error
      expect(mockCloseDependencies).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalled();
    });
  });
});
