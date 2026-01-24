export declare class UnitAIServer {
    private server;
    private dependencies;
    constructor();
    /**
     * Setup MCP Request Handlers
     */
    private setupHandlers;
    /**
     * Start the server
     */
    start(): Promise<void>;
    /**
     * Setup graceful shutdown handlers for SIGINT and SIGTERM
     */
    private setupShutdownHandlers;
    /**
     * Graceful shutdown
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map