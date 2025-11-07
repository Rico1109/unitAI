# Code Style & Conventions

## TypeScript Style
- **Strict Mode**: Enabled (`tsconfig.json`)
- **Module System**: ES Modules (`"type": "module"` in package.json)
- **Target**: ES2020+ compatible

## Naming Conventions
- **Files**: kebab-case (e.g., `ask-qwen.tool.ts`, `init-session.workflow.ts`)
- **Classes/Interfaces**: PascalCase
- **Functions/Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE (in constants.ts)

## Architecture Patterns
- **Tool Pattern**: Each AI backend exposed as MCP tool (`ask-qwen`, `ask-rovodev`, `ask-gemini`)
- **Workflow Pattern**: Complex orchestrations in `src/workflows/` with registry pattern
- **Registry Pattern**: Centralized tool/workflow registration
- **Utility Pattern**: Shared utilities in `src/utils/`

## File Organization
```
src/
├── tools/              # MCP tool definitions
│   ├── ask-*.tool.ts   # Individual AI tools
│   ├── smart-workflows.tool.ts  # Workflow router
│   └── registry.ts     # Tool registry
├── workflows/          # Workflow implementations
│   ├── types.ts        # Shared types
│   ├── utils.ts        # Common utilities
│   ├── index.ts        # Workflow registry
│   └── *.workflow.ts   # Individual workflows
├── utils/              # Utilities
│   ├── aiExecutor.ts   # CLI execution
│   ├── commandExecutor.ts
│   ├── gitHelper.ts    # Git operations
│   └── logger.ts
├── constants.ts        # Configuration constants
└── index.ts            # MCP server entry point
```

## Documentation
- **Tool Descriptions**: Detailed in README.md
- **JSDoc**: Use for complex functions
- **Comments**: Explain "why", not "what"
