 unitAI: Path to 10/10 Quality Score

 Date: 2026-02-04
 Current Score: 9.4/10 (+0.6 from completed tasks: Phase 1.1, 1.2)
 Target Score: 10/10
 Estimated Timeline: 1-2 months (Phase 1 complete)

 ---
 Executive Summary

 Validation Result: The weeks of refactoring work are SOUND and ALIGNED with the original project purpose. The codebase demonstrates excellent architecture, clean separation of concerns, and production-ready
 practices.

 Key Decision Validated: The "toolbox" approach (keep all 10 workflows, don't merge) was correctly implemented.

 Path to 10/10: Clear and achievable with prioritized improvements.

 ---
 Current State Assessment
 ┌────────────────────────┬────────┬─────────────────────────────────────────────────────────┐
 │         Aspect         │ Score  │                         Status                          │
 ├────────────────────────┼────────┼─────────────────────────────────────────────────────────┤
 │ Architecture Alignment │ 8.5/10 │ Strong - "toolbox" approach correctly implemented       │
 ├────────────────────────┼────────┼─────────────────────────────────────────────────────────┤
 │ Best Practices         │ 7.5/10 │ Good foundation with known issues                       │
 ├────────────────────────┼────────┼─────────────────────────────────────────────────────────┤
 │ Security               │ 6.5/10 │ Acceptable for single-user local development            │
 ├────────────────────────┼────────┼─────────────────────────────────────────────────────────┤
 │ Scope Adherence        │ 9/10   │ Minimal drift - additions were justified infrastructure │
 ├────────────────────────┼────────┼─────────────────────────────────────────────────────────┤
 │ Production Readiness   │ 8.2/10 │ Production-ready with documented caveats                │
 └────────────────────────┴────────┴─────────────────────────────────────────────────────────┘
 What Was Done WELL

 - 466/466 tests passing (100% pass rate)
 - Clean 7-layer architecture with proper separation
 - Registry, Repository, Circuit Breaker, Factory patterns used correctly
 - Security utilities with fail-closed policies
 - All P0 blockers resolved

 Security: Fears vs Reality
 ┌───────────────────────────────┬─────────────────────────┬────────────────────────────────────────────────────┐
 │           SEC Issue           │     Documented Fear     │                      Reality                       │
 ├───────────────────────────────┼─────────────────────────┼────────────────────────────────────────────────────┤
 │ SEC-007 trustedSource         │ "Bypasses all controls" │ Internal use only in workflows, appropriate design │
 ├───────────────────────────────┼─────────────────────────┼────────────────────────────────────────────────────┤
 │ SEC-008 skipPermissionsUnsafe │ "No authorization"      │ 3 safeguards: HIGH autonomy + dev mode + env var   │
 ├───────────────────────────────┼─────────────────────────┼────────────────────────────────────────────────────┤
 │ SEC-009 autoApprove           │ "No authorization"      │ Maps to CLI flags, controlled by autonomy level    │
 ├───────────────────────────────┼─────────────────────────┼────────────────────────────────────────────────────┤
 │ SEC-010 No auth/authz         │ "Missing system"        │ By design for local MCP server                     │
 ├───────────────────────────────┼─────────────────────────┼────────────────────────────────────────────────────┤
 │ SEC-011 No runtime validation │ "No validation"         │ Zod validation at tool boundaries                  │
 └───────────────────────────────┴─────────────────────────┴────────────────────────────────────────────────────┘
 ---
 Path to 10/10


 ## 🔴 CRITICAL: Phase 2.0 - Role-Based Backend Refactoring (Blocker)

**Reference**: `/home/rico/.gemini/antigravity/brain/0a4f5748-e38c-4464-9dae-de6477a94d0e/implementation_plan.md.resolved`

**Status**: 🔴 **BLOCKER** - Partially implemented, causing test failures

**Problem**: Workflows contain hardcoded `BACKENDS.*` references instead of using dynamic role-based selection from wizard config.

**Impact**:
- 6 test failures in `modelSelector.test.ts` and `workflows.test.ts`
- Configured backends (via wizard) are ignored
- Cannot reassign backends to different roles without code changes
- Test expectations misaligned with dynamic implementation

**Files Affected**:
| File | Lines | Issue |
|------|-------|-------|
| `src/workflows/parallel-review.workflow.ts` | 69-120, 151-178 | `switch (backend) { case BACKENDS.GEMINI: ... }` |
| `src/workflows/validate-last-commit.workflow.ts` | 77-125 | `switch (backend) { case BACKENDS.*: ... }` |
| `src/workflows/pre-commit-validate.workflow.ts` | 82-83 | `backend === BACKENDS.DROID ? ...` |
| `src/workflows/feature-design.workflow.ts` | 300+ | `switch (backendName) { ... }` |
| `src/config/config.ts` | 58-60 | Config uses short names (`'gemini'`) vs BACKENDS prefix (`'ask-gemini'`) |

**Implementation Required**:
1. Replace `switch (backend)` with role-based conditional logic
2. Fix naming mismatch between config and BACKENDS constant
3. Update tests to mock `getRoleBackend()` correctly
4. Update all workflow files to use role-based prompts and options

**See**: `Phase 2.0` below for detailed task breakdown 

 Phase 1: Quick Wins (Week 1) → 9.4/10 ✅ COMPLETE (2/2 tasks done)
 ┌─────────────────────────────────┬──────────┬────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │              Task               │  Effort  │ Impact │                                                      Files                                                       │
 ├─────────────────────────────────┼──────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 1.1 Replace Italian comments    │ DONE ✓   │ +0.1 ✓ │ src/workflows/triangulated-review.workflow.tssrc/workflows/feature-design.workflow.ts                            │
 ├─────────────────────────────────┼──────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 1.2 Add E2E tests (3 workflows) │ DONE ✓   │ +0.5 ✓ │ tests/e2e/parallel-review.e2e.test.tstests/e2e/pre-commit-validate.e2e.test.tstests/e2e/init-session.e2e.test.ts │
 └─────────────────────────────────┴──────────┴────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 Phase 2: Code Quality (Week 2-3) → 9.5/10 (2/4 tasks done, 1 critical blocker)
 ┌─────────────────────────────────────────────────┬──────────┬────────┬───────────────────────────────────────────────────────────────────────────────────────────┐
 │                      Task                       │  Effort  │ Impact │                                           Files                                           │
 ├─────────────────────────────────────────────────┼──────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
 │ 🔴 2.0 Role-based backend refactoring           │ 2-3 days │ +0.5   │ src/workflows/*.workflow.tssrc/workflows/model-selector.tssrc/config/config.ts           │
 ├─────────────────────────────────────────────────┼──────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
 │ 2.1 Complete async database migration           │ 1-2 days │ +0.3   │ src/dependencies.tssrc/repositories/circuit-breaker.repository.ts (new)                   │
 ├─────────────────────────────────────────────────┼──────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
 │ 2.2 Add correlation IDs                         │ DONE ✓   │ +0.2 ✓ │ src/services/structured-logger.tssrc/server.tssrc/tools/registry.ts                      │
 ├─────────────────────────────────────────────────┼──────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
 │ 2.3 Add autoApprove safeguards                  │ DONE ✓   │ +0.1 ✓ │ src/backends/cursor-backend.tssrc/backends/rovodev-backend.tssrc/backends/qwen-backend.ts │
 └─────────────────────────────────────────────────┴──────────┴────────┴───────────────────────────────────────────────────────────────────────────────────────────┘
 Phase 3: Infrastructure (Month 2) → 9.6/10
 ┌──────────────────────────────────┬──────────┬────────┬──────────────────────────────────────────────────────────────────────────────────────────────┐
 │               Task               │  Effort  │ Impact │                                            Files                                             │
 ├──────────────────────────────────┼──────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 3.1 Persist CircuitBreaker state │ 1 day    │ +0.2   │ src/repositories/circuit-breaker.repository.ts (new)src/utils/reliability/circuit-breaker.ts │
 ├──────────────────────────────────┼──────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 3.2 Health check endpoint        │ 1 day    │ +0.1   │ src/server.tssrc/tools/health.tool.ts (new)                                                  │
 ├──────────────────────────────────┼──────────┼────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
 │ 3.3 Metrics exposure endpoint    │ 1-2 days │ +0.1   │ src/tools/metrics.tool.ts (new)                                                              │
 └──────────────────────────────────┴──────────┴────────┴──────────────────────────────────────────────────────────────────────────────────────────────┘
 Phase 4: Observability (Month 2-3) → 10/10
 ┌───────────────────────────────┬──────────┬────────┬───────────────────────────────────────────────────┐
 │             Task              │  Effort  │ Impact │                       Files                       │
 ├───────────────────────────────┼──────────┼────────┼───────────────────────────────────────────────────┤
 │ 4.1 OpenTelemetry integration │ 3-5 days │ +0.2   │ src/infrastructure/tracing.ts (new)src/server.ts  │
 ├───────────────────────────────┼──────────┼────────┼───────────────────────────────────────────────────┤
 │ 4.2 Distributed tracing       │ 2-3 days │ +0.2   │ src/services/structured-logger.tssrc/tools/ (all) │
 └───────────────────────────────┴──────────┴────────┴───────────────────────────────────────────────────┘
 ---
 Detailed Implementation Plans

 🔴 Phase 2.0: Role-Based Backend Refactoring (BLOCKER)

 **Reference**: `/home/rico/.gemini/antigravity/brain/0a4f5748-e38c-4464-9dae-de6477a94d0e/implementation_plan.md.resolved`

 **Problem**: Workflows contain hardcoded `BACKENDS.*` references instead of using dynamic role-based selection.

 **Root Cause**: Naming mismatch between config system (short names) and BACKENDS constant (prefixed names).

 Current State:
 - Config uses: `'gemini'`, `'qwen'`, `'droid'`
 - BACKENDS uses: `'ask-gemini'`, `'ask-qwen'`, `'ask-droid'`

 **Files to Modify**:
 - `src/workflows/parallel-review.workflow.ts` (lines 69-120, 151-178)
 - `src/workflows/validate-last-commit.workflow.ts` (lines 77-125)
 - `src/workflows/pre-commit-validate.workflow.ts` (lines 82-83)
 - `src/workflows/feature-design.workflow.ts` (lines 300+)
 - `src/config/config.ts` (fix naming mismatch)
 - `tests/unit/workflows/modelSelector.test.ts` (mock `getRoleBackend()`)

 **Implementation Steps**:

 1. **Fix Config Naming** (`src/config/config.ts`)
    - Change default roles to use BACKENDS constant values
    - Or create a normalization function

 2. **Refactor Workflows** (all workflow files)
    - Replace `switch (backend) { case BACKENDS.GEMINI: ... }`
    - With: `if (backend === architectBackend) { ... }`
    - Get role backends from config at workflow start

 3. **Update Tests** (`modelSelector.test.ts`)
    - Mock `getRoleBackend()` to return BACKENDS constant values
    - Update test expectations for dynamic selection

 4. **Verification**:
    - All tests pass
    - Configured backends are used (not hardcoded)
    - Can reassign backends via wizard config

 **Estimated Effort**: 2-3 days

 **Impact**: +0.5 to quality score (unblocks dynamic backend configuration)

 ---

 Phase 1.1: Replace Italian Comments

 Files to modify:
 - src/workflows/triangulated-review.workflow.ts (~8 comments)
 - src/workflows/feature-design.workflow.ts (~2 comments)

 Approach:
 1. Read each file
 2. Locate Italian comments
 3. Translate to English
 4. Verify no semantic meaning is lost

 Verification:
 - Grep for Italian patterns: (?i)(TODO|FIXME|NOTE).*[a-z]{3,}\s*(?:che|per|della|delle|nella|nelle)

 ---
 Phase 1.2: Add E2E Tests

 New files to create:
 - tests/e2e/parallel-review.e2e.test.ts
 - tests/e2e/pre-commit-validate.e2e.test.ts
 - tests/e2e/init-session.e2e.test.ts

 Test structure:
 describe('E2E: parallel-review workflow', () => {
   it('should complete full workflow with mock backends', async () => {
     // 1. Start UnitAIServer
     // 2. Call tool with test inputs
     // 3. Verify mock backend was called
     // 4. Verify structured logs
     // 5. Verify RED metrics
     // 6. Verify audit trail
   });
 });

 Verification:
 - Run: npm run test:e2e
 - All 3 tests pass
 - No real AI calls made (all mocked)

 ---
 Phase 2.1: Complete Async Database Migration ⚠️ PARTIAL

**Status**: PARTIALLY COMPLETED (in-progress commit)

 Files to modify:
 - src/dependencies.ts - Remove sync database instances
 - src/repositories/metrics-repository.ts - Use AsyncDatabase throughout
 - src/utils/reliability/circuit-breaker.ts - Use AsyncDatabase for state

 Current state:
 interface AppDependencies {
   auditDb: AsyncDatabase;
   auditDbSync: Database.Database;  // ← Remove
   tokenDb: AsyncDatabase;
   tokenDbSync: Database.Database;   // ← Remove
 }

 Target state:
 interface AppDependencies {
   auditDb: AsyncDatabase;
   tokenDb: AsyncDatabase;
   metricsDb: AsyncDatabase;
   activityDb: AsyncDatabase;
   circuitBreaker: CircuitBreaker;  // Uses AsyncDatabase internally
 }

**Completed**:
- ✅ `src/dependencies.ts` - Removed sync database imports (better-sqlite3)
- ✅ `src/services/activityAnalytics.ts` - Removed sync database imports
- ✅ `src/repositories/metrics-repository.ts` - Uses AsyncDatabase throughout
- ✅ `src/utils/auditTrail.ts` - Uses AsyncDatabase throughout

**⚠️ DECISION REQUIRED**: CircuitBreaker Database Persistence

The CircuitBreaker (`src/utils/reliability/errorRecovery.ts`) currently uses in-memory state storage:
```typescript
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;  // ← In-memory
  private breakers: Map<string, CircuitBreaker> = new Map();  // ← In-memory
}
```

**Options**:
1. **Keep CircuitBreaker database-free** (State resets on server restart)
   - Pro: Faster, simpler, no persistence overhead
   - Con: Lost reliability history, backend may be retried too soon after restart

2. **Add AsyncDatabase persistence** to CircuitBreaker
   - Pro: State survives restarts, better reliability tracking
   - Con: Adds database dependency to error recovery path

**Decision Point**: Which approach to take? This affects whether 2.1 is "complete" or if database persistence is added.

Files to modify (if Option 2):
- `src/utils/reliability/errorRecovery.ts` - Use AsyncDatabase for state
- `src/dependencies.ts` - Inject AsyncDatabase into CircuitBreaker
- New file: `src/repositories/circuit-breaker.repository.ts` (optional abstraction)

Schema (if Option 2):
```sql
CREATE TABLE circuit_breaker_state (
  backend_name TEXT PRIMARY KEY,
  state TEXT NOT NULL,  -- CLOSED, OPEN, HALF_OPEN
  failure_count INTEGER NOT NULL,
  last_failure_time TEXT,
  last_state_change TEXT
);
```

 ---
 Phase 2.2: Add Correlation IDs ✅ DONE

 **Status**: COMPLETED (commit c6df3d9)

 **Implementation**:
 Generated unique correlation ID for each MCP request using format: `corr-{timestamp}-{random}`

 Files modified:
 - `src/tools/registry.ts`
   - Added `correlationId` to `ToolExecutionContext`
   - Updated `executeTool()` to generate and pass correlation ID
 - `src/server.ts`
   - Generate correlation ID for each request
   - Pass correlation ID through request context
 - `src/services/structured-logger.ts`
   - Added `correlationId` to `LogEntry` interface
   - Updated all log methods to accept and propagate correlation ID
   - Updated `forWorkflow()` to accept and pass correlation ID
   - Updated `WorkflowLogger` to propagate correlation ID

 Log output:
 {
   "timestamp": "2026-02-04T22:51:35.123Z",
   "level": "info",
   "category": "mcp",
   "component": "server",
   "operation": "tool-call",
   "message": "Tool call: parallel-review [requestId: mcp-..., correlationId: corr-...]",
   "correlationId": "corr-1738691495123-abc123"
 }

 **Verification**:
 - ✅ All log entries include correlation ID
 - ✅ Correlation ID propagates through entire request stack
 - ✅ TypeScript compilation passes
 - ✅ Tests pass (aiExecutor: 13/13)

--

 ---
 Phase 2.3: Add autoApprove Safeguards ✅ DONE

 **Status**: COMPLETED (commit c8fe6d4)

 Files modified:
 - src/backends/cursor-backend.ts
 - src/backends/rovodev-backend.ts
 - src/backends/qwen-backend.ts
 - tests/unit/aiExecutor.test.ts (2 new tests)

 **Implementation**:
 // Add same protections as skipPermissionsUnsafe
 if (autoApprove) {
   if (autonomyLevel !== AutonomyLevel.HIGH) {
     throw new Error('autoApprove requires HIGH autonomy level');
   }
   if (process.env.NODE_ENV === 'production') {
     throw new Error('autoApprove not allowed in production');
   }
   if (process.env.UNITAI_ALLOW_AUTO_APPROVE !== 'true') {
     throw new Error('autoApprove requires UNITAI_ALLOW_AUTO_APPROVE=true');
   }
 }

 **Verification**:
 - ✅ Tests verify autoApprove requires all 3 conditions
 - ✅ Audit log records autoApprove usage
 - ✅ Production environment blocks autoApprove regardless of other settings

 **Tests Added**:
 - `should include attachments, force and output format flags` (with proper safeguards)
 - `should block auto-approve when safeguards are not met`

 ---
 Phase 3.1: Persist CircuitBreaker State

 New file to create:
 - src/repositories/circuit-breaker.repository.ts

 Files to modify:
 - src/utils/reliability/circuit-breaker.ts
 - src/dependencies.ts

 Schema:
 CREATE TABLE circuit_breaker_state (
   backend_name TEXT PRIMARY KEY,
   state TEXT NOT NULL,  -- CLOSED, OPEN, HALF_OPEN
   failure_count INTEGER NOT NULL,
   last_failure_time TEXT,
   last_state_change TEXT
 );

 Verification:
 - Circuit breaker state survives server restart
 - Tests verify state persistence

 ---
 Phase 3.2: Health Check Endpoint

 New file to create:
 - src/tools/health.tool.ts

 Implementation:
 export const healthTool: UnifiedTool = {
   name: 'health',
   description: 'Health check endpoint',
   inputSchema: z.object({}),
   execute: async () => {
     const health = {
       status: 'healthy',
       uptime: process.uptime(),
       memory: process.memoryUsage(),
       databases: await checkDatabases(),
       backends: circuitBreaker.getAllStates()
     };
     return health;
   }
 };

 Verification:
 - Tool returns health status
 - Can be called via MCP client

 ---
 Phase 3.3: Metrics Exposure Endpoint

 New file to create:
 - src/tools/metrics.tool.ts

 Implementation:
 export const metricsTool: UnifiedTool = {
   name: 'metrics',
   description: 'RED metrics endpoint',
   inputSchema: z.object({
     timeRangeMinutes: z.number().default(60)
   }),
   execute: async ({ timeRangeMinutes }) => {
     return metricsRepository.getREDMetrics(timeRangeMinutes);
   }
 };

 Output:
 {
   "timeRangeMinutes": 60,
   "backends": {
     "gemini": { "rate": 45, "errors": 2, "duration": 1250 },
     "droid": { "rate": 30, "errors": 0, "duration": 2100 }
   }
 }

 ---
 Phase 4.1: OpenTelemetry Integration

 New file to create:
 - src/infrastructure/tracing.ts

 Dependencies to add:
 npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations

 Implementation:
 // src/infrastructure/tracing.ts
 import { NodeSDK } from '@opentelemetry/sdk-node';
 import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations';

 export function initTracing() {
   const sdk = new NodeSDK({
     traceExporter: new ConsoleSpanExporter(),
     instrumentations: [getNodeAutoInstrumentations()]
   });
   sdk.start();
 }

 Verification:
 - Spans exported for all workflow executions
 - Correlation IDs propagated in trace context

 ---
 Verification Checklist

 After each phase, verify:

 - All existing tests still pass (466/466)
 - New tests added pass
 - No TypeScript errors
 - ESLint passes
 - Quality score updated in SSOT document

 ---
 Risk Assessment
 ┌──────────────────────────────────┬────────────┬────────────────────────────────────────────┐
 │               Risk               │ Likelihood │                 Mitigation                 │
 ├──────────────────────────────────┼────────────┼────────────────────────────────────────────┤
 │ Async migration breaks tests     │ Medium     │ Comprehensive test coverage, rollback plan │
 ├──────────────────────────────────┼────────────┼────────────────────────────────────────────┤
 │ Circuit breaker persistence bugs │ Low        │ Simple schema, thorough testing            │
 ├──────────────────────────────────┼────────────┼────────────────────────────────────────────┤
 │ OpenTelemetry adds complexity    │ Low        │ Optional feature, can defer                │
 └──────────────────────────────────┴────────────┴────────────────────────────────────────────┘
 ---
 File Reference Summary

 Files to Modify (Existing)
 ┌───────────────────────────────────────────────┬──────────┬───────────────────────────────────────┐
 │                     File                      │  Phase   │                Change                 │
 ├───────────────────────────────────────────────┼──────────┼───────────────────────────────────────┤
 │ src/workflows/triangulated-review.workflow.ts │ 1.1      │ Replace Italian comments              │
 ├───────────────────────────────────────────────┼──────────┼───────────────────────────────────────┤
 │ src/workflows/feature-design.workflow.ts      │ 1.1      │ Replace Italian comments              │
 ├───────────────────────────────────────────────┼──────────┼───────────────────────────────────────┤
 │ src/dependencies.ts                           │ 2.1      │ Remove sync databases                 │
 ├───────────────────────────────────────────────┼──────────┼───────────────────────────────────────┤
 │ src/services/structured-logger.ts             │ 2.2      │ Add correlation ID                    │
 ├───────────────────────────────────────────────┼──────────┼───────────────────────────────────────┤
 │ src/server.ts                                 │ 2.2, 4.1 │ Generate correlation ID, init tracing │
 ├───────────────────────────────────────────────┼──────────┼───────────────────────────────────────┤
 │ src/utils/reliability/circuit-breaker.ts      │ 3.1      │ Persist state to database             │
 ├───────────────────────────────────────────────┼──────────┼───────────────────────────────────────┤
 │ src/backends/cursor-backend.ts                │ 2.3      │ Add autoApprove safeguards            │
 ├───────────────────────────────────────────────┼──────────┼───────────────────────────────────────┤
 │ src/backends/rovodev-backend.ts               │ 2.3      │ Add autoApprove safeguards            │
 ├───────────────────────────────────────────────┼──────────┼───────────────────────────────────────┤
 │ src/backends/qwen-backend.ts                  │ 2.3      │ Add autoApprove safeguards            │
 └───────────────────────────────────────────────┴──────────┴───────────────────────────────────────┘
 Files to Create (New)
 ┌────────────────────────────────────────────────┬───────┬─────────────────────────────┐
 │                      File                      │ Phase │           Purpose           │
 ├────────────────────────────────────────────────┼───────┼─────────────────────────────┤
 │ tests/e2e/parallel-review.e2e.test.ts          │ 1.2   │ E2E test                    │
 ├────────────────────────────────────────────────┼───────┼─────────────────────────────┤
 │ tests/e2e/pre-commit-validate.e2e.test.ts      │ 1.2   │ E2E test                    │
 ├────────────────────────────────────────────────┼───────┼─────────────────────────────┤
 │ tests/e2e/init-session.e2e.test.ts             │ 1.2   │ E2E test                    │
 ├────────────────────────────────────────────────┼───────┼─────────────────────────────┤
 │ src/repositories/circuit-breaker.repository.ts │ 3.1   │ Circuit breaker persistence │
 ├────────────────────────────────────────────────┼───────┼─────────────────────────────┤
 │ src/tools/health.tool.ts                       │ 3.2   │ Health check endpoint       │
 ├────────────────────────────────────────────────┼───────┼─────────────────────────────┤
 │ src/tools/metrics.tool.ts                      │ 3.3   │ Metrics exposure            │
 ├────────────────────────────────────────────────┼───────┼─────────────────────────────┤
 │ src/infrastructure/tracing.ts                  │ 4.1   │ OpenTelemetry setup         │
 └────────────────────────────────────────────────┴───────┴─────────────────────────────┘
 ---
 Conclusion

 The path to 10/10 is clear and achievable. The refactoring work done to date is sound and aligned with the original project purpose. The remaining improvements are well-scoped, prioritized by impact, and can be
 completed over 2-3 months.