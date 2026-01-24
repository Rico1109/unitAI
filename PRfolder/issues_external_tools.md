---
title: External Tool Issues
version: 1.0.0
updated: 2026-01-24T23:28:00+01:00
scope: external-tools
category: issues
---

# External Tool Issues

Issues found in external tools used in the development workflow.

---

## CLAUDE-001: tail -f Process Not Terminated After Task Completion

**Tool:** Claude Code CLI
**Severity:** Low (cosmetic/UX)
**Observed:** 2026-01-24

**Description:**
When Claude Code executes a task that produces output, it uses `tail -f` to stream the output file:

```
tail -f /tmp/claude/-home-rico-Projects-CodeBase/tasks/<task-id>.output
```

**Problem:**
The `tail -f` process continues running indefinitely even after the underlying task completes. This causes:
- Shell shows "running" status for 15+ minutes after completion
- User confusion about whether task is still active
- Need to manually Ctrl+C to terminate

**Expected Behavior:**
Claude Code should:
1. Detect when the monitored task completes
2. Automatically terminate the `tail -f` process
3. Show task as "completed" in shell status

**Workaround:**
Press `Ctrl+C` in the terminal to terminate the hanging tail process.

**To Report:**
Consider reporting to Anthropic via Claude Code feedback mechanism.

---
