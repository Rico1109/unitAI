# Suggested Commands

## Development Workflow

### Building
```bash
npm run build          # Compile TypeScript to dist/
```

### Development
```bash
npm run dev           # Build + run with node
npm run lint          # Type checking (tsc --noEmit)
npm start             # Run production build
```

### Testing
```bash
node test-workflows.js  # Test workflows locally
```

### Publishing
```bash
npm version patch      # Bump version
npm publish           # Publish to npm
```

## When Task is Completed

### 1. Type Checking
```bash
npm run lint
```
**Must pass** without errors before considering task complete.

### 2. Build
```bash
npm run build
```
Ensures TypeScript compiles without errors.

### 3. Testing (if applicable)
```bash
node test-workflows.js
```
For workflow changes, verify with test script.

### 4. Claude Desktop Testing
Edit `~/.config/claude/claude_desktop_config.json` (Linux):
```json
{
  "mcpServers": {
    "unified-ai-local": {
      "command": "node",
      "args": ["/absolute/path/to/unified-ai-mcp-tool/dist/index.js"]
    }
  }
}
```
Restart Claude Desktop and test manually.

## Git Commands
```bash
git status                          # Check status
git add .                           # Stage all
git commit -m "feat: description"   # Commit with conventional commit
git push                            # Push to remote
```

## System Utilities (Linux)
- `ls`, `cd`, `pwd`: Navigation
- `grep`, `find`: Search
- `cat`, `less`: File viewing
- `chmod +x`: Make executable
