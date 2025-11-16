---
name: unified-ai-orchestration
description: Use unified-ai-mcp for multi-model AI analysis when complexity requires different perspectives. Run ask-gemini + ask-qwen in parallel for comprehensive validation. Add ask-rovodev for production-ready code generation. Choose the right model(s) based on task complexity and iteration speed.
---

# Unified AI Orchestration Skill

## Purpose

Leverage multiple AI backends through unified-ai-mcp MCP server for robust analysis, implementation, and validation.

## Model Strengths (Guidelines, Not Rules)

### ask-gemini - Deep Reasoning
- Architectural design and security analysis
- Complex refactoring strategies
- Best practices and code quality
- Use for: high-stakes changes, architectural decisions

### ask-qwen - Fast Iteration
- Quick code quality checks and edge case detection
- Pattern recognition and redundancy identification
- Use for: rapid iteration, second opinions, quick validation

### ask-rovodev - Production Code
- Production-ready code generation
- Bug fixes with proper error handling
- Use for: clear implementation requirements, working prototypes

## Key Patterns

### Parallel Execution (Comprehensive Validation)
Run Gemini + Qwen simultaneously for different perspectives:
```bash
mcp__unified-ai-mcp__ask-gemini --prompt "@file.ts Validate architecture, security, performance"
mcp__unified-ai-mcp__ask-qwen --prompt "@file.ts Check quality, edge cases, bugs"
```
Use when: pre-commit review, critical changes, multiple perspectives needed

### Sequential Flow (Feature Development)
1. Design with Gemini (architecture)
2. Implement with Rovodev (code)
3. Validate with Qwen (quick review)

Use when: building new features, need design → implementation → validation

## Autonomous Decision Making

Let Claude choose based on context:
- Single model: Simple tasks, clear requirements
- Parallel models: Validation, comprehensive review
- Sequential models: Learning, feature development

Trust your judgment - these are guidelines to help, not rules to enforce.

---

**Skill Status**: Active
**Best Practice**: Parallel for validation, sequential for learning
