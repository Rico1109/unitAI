```
   _   _       _  __ _          _      _    _   __  __  ____  ____  
  | | | |_ __ (_)/ _(_) ___  __| |    / \  (_)  |  \/  |/ ___||  _ \ 
  | | | | '_ \| | |_| |/ _ \/ _` |   / _ \ | |  | |\/| | |    | |_) |
  | |_| | | | | |  _| |  __/ (_| |  / ___ \| |  | |  | | |___ |  __/ 
   \___/|_| |_|_|_| |_|\___|\__,_| /_/   \_\_|  |_|  |_|\____||_|    
                                                                      
```

<div align="center">

**🚀 One MCP Server. Three AI Powerhouses. Infinite Possibilities.**

[![npm version](https://img.shields.io/npm/v/@jaggerxtrm/unified-ai-mcp-tool.svg)](https://www.npmjs.com/package/@jaggerxtrm/unified-ai-mcp-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

A unified [Model Context Protocol](https://modelcontextprotocol.io) server that provides seamless access to **Qwen Code**, **Atlassian Rovo Dev**, and **Google Gemini** through a single, elegant interface.

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Tools](#-available-tools) • [Configuration](#-configuration)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎯 **Unified Interface**
Single MCP server for multiple AI backends - no need to manage separate connections

### 📁 **Smart File References**  
Use `@filename` syntax to include files in your prompts automatically

### 🛡️ **Safety First**
Sandbox and shadow modes for safe code execution and testing

</td>
<td width="50%">

### 🔄 **Session Management**
Restore previous conversations and maintain context across sessions

### ⚡ **Optimized Performance**
~50% token reduction through intelligent optimization

### 🎨 **Rich Progress Tracking**
Real-time feedback on long-running operations

</td>
</tr>
</table>

---

## 🚀 Installation

### Global Installation (Recommended)

```bash
npm install -g @jaggerxtrm/unified-ai-mcp-tool
```

### Local Installation

```bash
npm install @jaggerxtrm/unified-ai-mcp-tool
```

### From Source

```bash
git clone https://github.com/jaggerxtrm/unified-ai-mcp-tool.git
cd unified-ai-mcp-tool
npm install
npm run build
```

---

## 🎯 Quick Start

### 1. Add to MCP Configuration

**For Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "unified-ai": {
      "command": "unified-ai-mcp-tool"
    }
  }
}
```

**For Custom MCP Clients:**

```json
{
  "mcpServers": {
    "unified-ai": {
      "command": "node",
      "args": ["/path/to/unified-ai-mcp-tool/dist/index.js"]
    }
  }
}
```

### 2. Start Using

Once configured, you can use any of the three AI tools through your MCP client:

```
# Query Qwen about your codebase
@src/ Explain the architecture of this project

# Ask Rovo Dev to refactor code safely
@utils/helper.ts Refactor this with shadow mode

# Get Gemini to review documentation
@README.md Is this documentation clear and complete?
```

---

## 🛠️ Available Tools

### 🤖 ask-qwen

Query Qwen AI with support for file analysis, codebase exploration, and large context windows.

<details>
<summary><b>Parameters & Examples</b></summary>

**Parameters:**
- `prompt` *(required)*: Query for Qwen. Use `@filename` or `#filename` to include files
- `model` *(optional)*: Model to use (default: `qwen3-coder-plus`)
  - `qwen3-coder-plus` - Best balance
  - `qwen3-coder-turbo` - Faster
  - `qwen3-coder-pro` - Highest quality
  - `qwen3-coder` - Base model
  - `qwen3-coder-fallback` - Fallback
- `sandbox` *(optional)*: Use sandbox mode for safe code execution
- `approvalMode` *(optional)*: Approval mode: `plan`/`default`/`auto-edit`/`yolo`
- `yolo` *(optional)*: Auto-approve all operations

**Examples:**

```json
{
  "prompt": "@src/ Explain this codebase structure",
  "model": "qwen3-coder-plus"
}
```

```json
{
  "prompt": "Create a sorting algorithm and test it",
  "sandbox": true,
  "yolo": true
}
```

</details>

---

### 🏢 ask-rovodev

Query Atlassian Rovo Dev AI with shadow mode and session management.

<details>
<summary><b>Parameters & Examples</b></summary>

**Parameters:**
- `prompt` *(required)*: Query for Rovodev. Use `@filename` to reference files
- `yolo` *(optional)*: Auto-approve all operations
- `shadow` *(optional)*: Shadow mode for safe changes
- `verbose` *(optional)*: Verbose output
- `restore` *(optional)*: Continue last session

**Examples:**

```json
{
  "prompt": "@package.json Analyze dependencies",
  "verbose": true
}
```

```json
{
  "prompt": "@src/utils/ Refactor these utilities",
  "shadow": true,
  "yolo": true
}
```

</details>

---

### 🌟 ask-gemini

Query Google Gemini with file analysis support.

<details>
<summary><b>Parameters & Examples</b></summary>

**Parameters:**
- `prompt` *(required)*: Query. Use `@filename` to reference files
- `model` *(optional)*: Model (default: `gemini-2.5-pro`)
  - `gemini-2.5-pro` - Most capable
  - `gemini-2.5-flash` - Faster, cost-effective
- `sandbox` *(optional)*: Sandbox mode

**Examples:**

```json
{
  "prompt": "@README.md Improve this documentation",
  "model": "gemini-2.5-flash"
}
```

```json
{
  "prompt": "@tests/ Review test coverage",
  "model": "gemini-2.5-pro"
}
```

</details>

---

## 📚 File Reference Syntax

All `ask-*` tools support powerful file references:

| Syntax | Description | Example |
|--------|-------------|---------|
| `@filename` | Include specific file | `@src/index.ts` |
| `#filename` | Alternative syntax | `#package.json` |
| `@directory/` | Include directory | `@src/utils/` |
| Multiple refs | Reference many files | `@file1.ts @file2.ts` |

**Example:**
```
@src/index.ts @src/tools/ Explain how the tool registration works
```

---

## 🔧 Configuration

### Execution Modes

#### 🛡️ Sandbox Mode (Qwen, Gemini)
Safe environment for code execution:
```json
{
  "prompt": "Create and test a new feature",
  "sandbox": true
}
```

#### 👻 Shadow Mode (Rovo Dev)
Work on temporary workspace copy:
```json
{
  "prompt": "Refactor this module",
  "shadow": true
}
```

#### ✅ Approval Modes (Qwen)
Control operation approval:
- `plan` - Analysis only
- `default` - Prompt each time
- `auto-edit` - Auto-approve edits
- `yolo` - Auto-approve all

---

## 📋 Prerequisites

### Required CLIs

<table>
<tr>
<th>AI Tool</th>
<th>CLI Installation</th>
<th>Verification</th>
</tr>
<tr>
<td><strong>Qwen Code</strong></td>
<td>

```bash
pip install qwen-code-cli
```

</td>
<td>

```bash
qwen --version
```

</td>
</tr>
<tr>
<td><strong>Rovo Dev</strong></td>
<td>

```bash
npm install -g @atlassian/acli
```

</td>
<td>

```bash
acli rovodev --help
```

</td>
</tr>
<tr>
<td><strong>Gemini</strong></td>
<td>

```bash
npm install -g @google/generative-ai-cli
```

</td>
<td>

```bash
gemini --version
```

</td>
</tr>
</table>

> **Note:** You only need to install the CLIs for the AI tools you plan to use.

---

## 🏗️ Development

```bash
# Clone repository
git clone https://github.com/jaggerxtrm/unified-ai-mcp-tool.git
cd unified-ai-mcp-tool

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development
npm run dev

# Type checking
npm run lint

# Production start
npm start
```

### Project Structure

```
unified-ai-mcp-tool/
├── src/
│   ├── tools/              # Tool definitions
│   │   ├── ask-qwen.tool.ts
│   │   ├── ask-rovodev.tool.ts
│   │   ├── ask-gemini.tool.ts
│   │   ├── registry.ts     # Tool registry
│   │   └── index.ts
│   ├── utils/              # Utilities
│   │   ├── aiExecutor.ts   # CLI execution
│   │   ├── commandExecutor.ts
│   │   └── logger.ts
│   ├── constants.ts        # Configuration
│   └── index.ts            # MCP server
├── dist/                   # Compiled output
├── package.json
└── tsconfig.json
```

---

## 📊 Performance

### Token Optimization

The Unified AI MCP has been optimized to reduce token waste:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Tools** | 7 | 3 | 57% reduction |
| **Token Usage** | ~10k | ~5k | 50% reduction |
| **Context Saved** | - | ~10-15 files | Per conversation |

See [improvements.md](./improvements.md) for detailed optimization information.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- 📦 [npm Package](https://www.npmjs.com/package/@jaggerxtrm/unified-ai-mcp-tool)
- 🐙 [GitHub Repository](https://github.com/jaggerxtrm/unified-ai-mcp-tool)
- 📖 [Model Context Protocol](https://modelcontextprotocol.io)
- 🤖 [Qwen Code](https://github.com/QwenLM/qwen-code)
- 🏢 [Atlassian Rovo Dev](https://developer.atlassian.com/rovodev/)
- 🌟 [Google Gemini](https://ai.google.dev/)

---

<div align="center">

**Made with ❤️ by developers, for developers**

⭐ Star this repo if you find it useful!

</div>
