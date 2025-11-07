# Task Completion Checklist

When a task is marked as "done", the following steps should be completed:

## 1. Code Quality
- [ ] **Type checking passes**: `npm run lint` (no errors)
- [ ] **Build succeeds**: `npm run build` (compiles without errors)
- [ ] **No console.log left**: Remove debugging statements
- [ ] **Code follows conventions**: Check naming, structure, patterns

## 2. Testing
- [ ] **Local testing**: Run `node test-workflows.js` if applicable
- [ ] **Claude Desktop testing**: Test with real MCP client
- [ ] **Edge cases considered**: Test error handling

## 3. Documentation
- [ ] **README.md updated**: If new features/tools added
- [ ] **JSDoc comments**: For public functions/complex logic
- [ ] **CHANGELOG.md updated**: Document changes (if significant)

## 4. Version Control
- [ ] **Changes staged**: `git add .`
- [ ] **Meaningful commit message**: Follow conventional commits
  - `feat:` New feature
  - `fix:` Bug fix
  - `refactor:` Code refactoring
  - `docs:` Documentation
  - `chore:` Maintenance
- [ ] **Branch is up-to-date**: `git pull` before push

## 5. Integration Checklist (for workflow/tool changes)
- [ ] **Tool registered**: Added to `src/tools/registry.ts`
- [ ] **Workflow registered**: Added to `src/workflows/index.ts`
- [ ] **Types defined**: In `src/workflows/types.ts` if needed
- [ ] **MCP schema valid**: Zod schemas properly defined

## 6. Pre-Commit (if using hooks)
- [ ] **Hooks pass**: All .claude/hooks/ scripts succeed
- [ ] **Memories updated**: If architectural decisions made
- [ ] **Skills updated**: If new patterns emerge

## Common Gotchas
- Don't forget to rebuild (`npm run build`) before testing in Claude Desktop
- MCP config changes require Claude Desktop restart
- Workflow params must match Zod schema exactly
- File paths in @filename syntax must be relative to working directory
