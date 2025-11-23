# Project Overview: unitai

## Purpose
Unified Model Context Protocol server that provides seamless access to **Qwen Code**, **Atlassian Rovo Dev**, and **Google Gemini** through a single interface. 

**Vision**: Transform Claude Code into a "Master AI Boss" capable of autonomous orchestration of multi-model AI, specialized agents, and intelligent workflows.

## Key Features
- **Unified Interface**: Single MCP server for multiple AI backends
- **Smart Workflows**: Intelligent orchestration (init-session, parallel-review, validate-last-commit)
- **File Reference Syntax**: `@filename` or `#filename` to include files in prompts
- **Recursive MCP Architecture**: Workflows can invoke other MCP servers (Serena, claude-context, context7, deepwiki, openmemory)
- **Safety Modes**: Sandbox (Qwen/Gemini), Shadow (Rovodev), Approval modes

## Architecture
- **Level 1**: User Interface (Claude Code CLI)
- **Level 2**: Automation (Hooks + Skills)
- **Level 3**: Execution (unitai)
- **Level 4**: Orchestration (Smart Workflows with recursive MCP calls)

## Target Metrics
- Token efficiency: 95%+ reduction (45K → 500-2K tokens)
- Autonomy rate: >90%
- Safe refactoring: >98% with Serena integration
