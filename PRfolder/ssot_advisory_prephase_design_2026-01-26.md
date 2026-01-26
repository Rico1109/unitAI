# Advisory Pre-Phase Feature Design

> **Status**: 📋 PLANNED (validated architecture, not implemented)  
> **Priority**: Low (new features are last in project queue)  
> **Created**: 2026-01-26  

---

## Problem Statement

Solo developers using agentic LLMs face a **knowledge asymmetry**: they have ideas but don't know which patterns/structures would make their code enterprise-quality. Current workflows require high-quality input to produce high-quality output.

**Example**: volumepressureV2 - the deque optimization was only discovered because the user learned about it externally, not from the agent. The agent never proposed it despite being the optimal solution for the sliding window pattern.

---

## Proposed Solution: Advisory Pre-Phase

A multi-agent workflow that plugs in **before** feature-design to transform vague user input into well-researched specifications.

```
[Vague User Input + Code Location]
     ↓
┌─────────────────────────────────────────────┐
│     ADVISORY PRE-PHASE (Multi-Agent)        │
│                                             │
│   CodeAnalysisAgent                         │
│       ↓ (structured code facts)             │
│   QuestionGeneratorAgent                    │
│       ↓ (targeted research questions)       │
│   ResearchAgent                             │
│       ↓ (options with tradeoffs)            │
└─────────────────────────────────────────────┘
     ↓
[Enhanced featureDescription]
     ↓
[Standard feature-design workflow]
```

---

## Validated Architecture (from feature-design workflow)

### 3 New Agents
| Agent | Purpose | Output |
|-------|---------|--------|
| CodeAnalysisAgent | Extract observable facts from code | Structured YAML (data structures, access patterns, memory behavior) |
| QuestionGeneratorAgent | Convert observations into research questions | 3-5 targeted questions derived from code facts |
| ResearchAgent | Study domain options and tradeoffs | Options with recommendation |

### Key Design Decisions
1. **Agent-to-agent dialogue**: No human questions during advisory phase
2. **Code-grounded**: Questions derived from actual code, not generic
3. **Enhances existing workflow**: Outputs enhanced featureDescription, doesn't replace anything

### Implementation Recommendations (from ArchitectAgent)
1. Formalize contracts with TypeScript (`src/types/advisory-contracts.ts`)
2. Build dedicated workflow orchestrator (`src/workflows/advisory-prephase.workflow.ts`)
3. Adhere to BaseAgent pattern for consistency
4. Use structured output (function calling) over YAML parsing
5. Consider tree-sitter for static analysis (optional, can start simpler)
6. Add google_web_search tool for ResearchAgent (optional)
7. Make it optional first step in feature-design workflow

---

## Files to Create (When Ready)

```
unitAI/src/
├── types/advisory-contracts.ts           (new)
├── agents/
│   ├── CodeAnalysisAgent.ts              (new)
│   ├── QuestionGeneratorAgent.ts         (new)
│   └── ResearchAgent.ts                  (new)
└── workflows/
    ├── advisory-prephase.workflow.ts     (new)
    └── feature-design.workflow.ts        (modify)

unitAI/tests/
├── agents/
│   ├── CodeAnalysisAgent.test.ts         (new)
│   ├── QuestionGeneratorAgent.test.ts    (new)
│   └── ResearchAgent.test.ts             (new)
└── workflows/
    └── advisory-prephase.workflow.test.ts (new)
```

---

## Related Artifacts

- Design prompts: `~/.gemini/antigravity/brain/03467874.../advisory_workflow_prompts.md`

---

## When to Implement

After completing current unitAI pyramid priorities:
1. ~~Reliability remediation~~
2. ~~Observability~~
3. **New features** ← This belongs here
