# Tech Stack

## Core Technologies
- **Language**: TypeScript 5.0+
- **Runtime**: Node.js >=16.0.0
- **Package Manager**: npm

## Dependencies
- **@modelcontextprotocol/sdk**: ^1.21.0 (MCP protocol implementation)
- **zod**: ^3.25.76 (Schema validation)
- **zod-to-json-schema**: ^3.24.6 (Schema conversion)

## DevDependencies
- **@types/node**: ^24.0.0
- **typescript**: ^5.0.0

## External CLIs (Optional)
- **Qwen Code**: `pip install qwen-code-cli`
- **Rovo Dev**: `npm install -g @atlassian/acli`
- **Gemini**: `npm install -g @google/generative-ai-cli`

## MCP Ecosystem
- **claude-context**: Semantic code search (embeddings-based)
- **Serena**: LSP-based symbol surgery
- **context7**: External API documentation
- **deepwiki**: GitHub repository analysis
- **openmemory-local**: Persistent memory store
- **unitAI** (this project): Multi-AI orchestrator with recursive MCP capability
