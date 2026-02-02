---
title: Git Workflow & PR Strategy
version: 2.0.0
updated: 2026-01-24T17:30:00+01:00
scope: unitai-git-workflow
category: plan
subcategory: version-control
status: active
domain: [git, pr-strategy, best-practices]
changelog:
  - 2.0.0 (2026-01-24): Update to single-commit strategy (token-efficient).
  - 1.0.0 (2026-01-24): Initial git workflow plan for pyramid-based development.
---

# Git Workflow & PR Strategy for unitAI

## Objective

Establish a professional git workflow that delivers clean, reviewable PRs aligned with the software engineering pyramid, following industry best practices.

---

## The Pyramid PR Strategy

Each pyramid layer gets its own PR, building on the previous layer:

```
                        🔺 PR #7: NEW FEATURES
                      ──────────────────────────
                     PR #6: OPTIMIZATIONS (perf, cost)
                   ────────────────────────────────────
                  PR #5: CODE ORGANIZATION (DRY, SOLID)
                ────────────────────────────────────────
               PR #4: OBSERVABILITY (logs, metrics, traces)
             ──────────────────────────────────────────────
            PR #3: TESTING INFRASTRUCTURE (unit → e2e, CI)
          ────────────────────────────────────────────────
         PR #2: RELIABILITY (error handling, graceful degradation)
       ──────────────────────────────────────────────────────────
      PR #1: SECURITY (input validation, secrets, least privilege)
     ────────────────────────────────────────────────────────────
    PR #0: DEPENDENCY INJECTION & LIFECYCLE ← CURRENT
   ──────────────────────────────────────────────────────
  📐 ARCHITECTURE SSOT (docs) ← FOUNDATION (no PR, living docs)
```

---

## Branch Naming Convention

Follow the pattern: `<type>/<pyramid-layer>-<short-description>`

### Examples

| Branch | Pyramid Layer | Description |
|--------|---------------|-------------|
| `feat/di-lifecycle` | DI & Lifecycle | Current branch |
| `feat/security-hardening` | Security | PR #1 |
| `feat/reliability-improvements` | Reliability | PR #2 |
| `test/infrastructure-setup` | Testing | PR #3 |
| `feat/observability-layer` | Observability | PR #4 |
| `refactor/code-organization` | Code Organization | PR #5 |
| `perf/optimization-layer` | Optimizations | PR #6 |
| `feat/new-features` | New Features | PR #7 |

### Branch Types

- `feat/` - New features or capabilities
- `fix/` - Bug fixes
- `refactor/` - Code restructuring without behavior change
- `test/` - Test infrastructure
- `perf/` - Performance improvements
- `docs/` - Documentation updates
- `chore/` - Maintenance tasks

---

## Commit Message Standard

Use **Conventional Commits** specification: `<type>(<scope>): <subject>`

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `docs`: Documentation changes
- `perf`: Performance improvements
- `chore`: Maintenance tasks
- `style`: Code style changes (formatting, semicolons, etc.)
- `build`: Build system changes
- `ci`: CI/CD changes

### Scope

Component affected (e.g., `di`, `audit-trail`, `activity-analytics`, `tests`)

### Subject

- Imperative mood: "add", not "added" or "adds"
- No capitalization of first letter
- No period at the end
- Max 50 characters

### Body (Optional)

- Wrap at 72 characters
- Explain **what** and **why**, not **how**
- Separate from subject with blank line

### Footer (Optional)

- Breaking changes: `BREAKING CHANGE: <description>`
- Issue references: `Fixes #123`, `Closes #456`

### Examples

**Good: Comprehensive single commit (RECOMMENDED)**

```
feat(di): consolidate database connections under DI container

Establishes centralized database lifecycle management by consolidating
all SQLite connections under the DI container.

Implementation:
- Add auditDb and tokenDb to AppDependencies interface
- Initialize DBs with WAL mode in initializeDependencies()
- Refactor AuditTrail to accept injected Database via constructor
- Refactor TokenSavingsMetrics to accept injected Database
- Add getAuditTrail() and getMetricsCollector() factory functions
- Update ActivityAnalytics to use dependency injection

Testing:
- Create testDependencies.ts helper for in-memory DBs
- Update activityAnalytics.test.ts to use DI pattern
- Update tokenEstimator.metrics.test.ts for DI
- Fix 19 DI-related test failures (21 → 2, 99.2% pass rate)

Documentation:
- Update architecture SSOT (v2.1.0) with DI details
- Create DI implementation plan document
- Create git workflow & PR strategy guide
- Update known issues registry (mark 3 issues resolved)

Fixes #001 (DI-001: AuditTrail creates own DB)
Fixes #002 (DI-002: TokenSavingsMetrics creates own DB)
Fixes #003 (TEST-001: Tests fail when DI not initialized)
```

**Bad: Multiple small commits (AVOID - wastes tokens)**

```
❌ feat(di): add auditDb to container
❌ refactor(audit-trail): use DI
❌ test(di): add test helpers
❌ docs(ssot): update architecture
❌ build: recompile TypeScript
```

These would need squashing anyway, so start with one commit.

---

## Git Workflow

### 1. Initial Setup (One-time)

```bash
# Fork or clone repository
git clone https://github.com/jaggerxtrm/unitai.git
cd unitai

# Set up upstream (if forked)
git remote add upstream https://github.com/jaggerxtrm/unitai.git

# Create base branch for pyramid work
git checkout -b feat/di-lifecycle
```

### 2. Development Cycle

**Best Practice: ONE comprehensive commit per PR**

```bash
# Work on ALL changes for this pyramid layer
# - Implement code changes
# - Write/update tests
# - Update documentation
# - Build to verify

npm run build
npm test

# When complete, stage EVERYTHING
git add src/ tests/ PRfolder/ dist/

# Create ONE comprehensive commit with detailed message
git commit -m "feat(di): consolidate database connections under DI container

Implementation:
- Add auditDb and tokenDb to AppDependencies interface
- Refactor AuditTrail and TokenSavingsMetrics to use DI
- Add factory functions for lazy singletons

Testing:
- Create testDependencies.ts helper
- Update tests to use in-memory DBs
- Fix 19 DI-related test failures

Documentation:
- Update architecture SSOT (v2.1.0)
- Create DI implementation plan
- Update known issues registry

Fixes #001, #002, #003"
```

**Why single commit?**
- ✅ **Token efficient** - No wasted context on multiple commits
- ✅ **Clean history** - One commit per PR = one logical change
- ✅ **Easy review** - All related changes in one place
- ✅ **Simple revert** - One command to undo entire feature
- ✅ **No squash needed** - Already optimal for main branch

### 3. Pre-PR Checklist

Before creating the single commit and opening PR:

- [ ] All changes complete (code + tests + docs)
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Lint passes: `npm run lint` (or tsc --noEmit)
- [ ] SSOT docs updated and committed
- [ ] Commit message follows Conventional Commits
- [ ] Commit message includes Implementation/Testing/Documentation sections
- [ ] All issue references in commit footer (Fixes #123)
- [ ] No debug code or console.logs (unless intentional)
- [ ] No commented-out code
- [ ] No merge conflicts with base branch
- [ ] `dist/` compiled and included

### 4. Opening the PR

```bash
# Push branch to remote
git push origin feat/di-lifecycle

# Create PR via GitHub UI or CLI
gh pr create --title "feat: consolidate database connections under DI container" \
  --body-file .github/pull_request_template.md
```

### 5. During Review

```bash
# Fetch latest changes
git fetch upstream

# Rebase on latest main (keep history clean)
git rebase upstream/main

# Fix review comments by amending the single commit
git add <fixed-files>
git commit --amend --no-edit

# Or update the commit message if needed
git commit --amend

# Force push (after rebase or amend)
git push --force-with-lease origin feat/di-lifecycle
```

**Note:** Since we have only ONE commit, use `--amend` for all changes.

### 6. After Merge

```bash
# Switch to main
git checkout main

# Pull merged changes
git pull upstream main

# Delete local branch
git branch -d feat/di-lifecycle

# Delete remote branch (if not auto-deleted)
git push origin --delete feat/di-lifecycle

# Start next pyramid layer
git checkout -b feat/security-hardening
```

---

## PR Template

Create `.github/pull_request_template.md`:

```markdown
## Pyramid Layer

<!-- Check the layer this PR addresses -->
- [ ] 📐 Architecture SSOT (documentation)
- [x] 🔧 Dependency Injection & Lifecycle
- [ ] 🔒 Security
- [ ] 💪 Reliability
- [ ] 🧪 Testing Infrastructure
- [ ] 📊 Observability
- [ ] 🏗️ Code Organization
- [ ] ⚡ Optimizations
- [ ] ✨ New Features

## Summary

<!-- Brief description of changes (2-3 sentences) -->

## Changes

<!-- List of key changes -->
-
-
-

## Testing

<!-- How were these changes tested? -->
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] All tests passing

## SSOT Documentation

<!-- Links to updated SSOT docs -->
- [ ] Architecture SSOT updated
- [ ] Known Issues updated (if applicable)
- [ ] Plan document created (if applicable)

## Checklist

- [ ] Code builds without errors
- [ ] Tests pass (npm test)
- [ ] Lint passes (npm run lint)
- [ ] Conventional commit messages
- [ ] BREAKING CHANGE noted (if applicable)
- [ ] Related issues linked

## Related Issues

<!-- Reference any related issues -->
Fixes #
Closes #
Related to #

## Screenshots (if applicable)

<!-- Add screenshots for UI changes or terminal output -->
```

---

## Merge Strategy

Since we use **one commit per PR**, use **rebase and merge** on GitHub:

- ✅ Single commit in branch → Single commit in main
- ✅ Clean linear history
- ✅ No merge commits
- ✅ Detailed commit message preserved

**Alternative: Squash and merge** (works but redundant)
- If you accidentally made multiple commits, GitHub can squash
- But better to start with one commit from the beginning

**Never use: Create a merge commit**
- ❌ Creates ugly merge bubbles in history
- ❌ Clutters git log

**Example:**
```
Before merge (PR branch):
  * bd102dc feat(di): consolidate database connections under DI container

After merge (main):
  * bd102dc feat(di): consolidate database connections under DI container (#42)
  * f676941 build: regenerate dist after merge
```

Clean, linear, efficient.

---

## Code Review Checklist

### For Reviewer

- [ ] PR addresses single pyramid layer
- [ ] Commit messages follow Conventional Commits
- [ ] SSOT documentation updated
- [ ] Tests added for new functionality
- [ ] No breaking changes (unless noted in BREAKING CHANGE)
- [ ] Code follows existing patterns
- [ ] No security vulnerabilities introduced
- [ ] Performance implications considered
- [ ] Error handling appropriate
- [ ] Logging appropriate (no excessive logs)

### For Author

Before requesting review:
- [ ] Self-review code on GitHub
- [ ] Check PR diff for unintended changes
- [ ] Verify all CI checks pass
- [ ] Link related issues
- [ ] Add context in PR description
- [ ] Tag appropriate reviewers

---

## Multi-PR Dependency Strategy

When PRs build on each other:

### Option 1: Sequential (Recommended)

```
PR #0 (DI) → Merged → PR #1 (Security) → Merged → PR #2 (Reliability)
```

**Pros:**
- Clean, linear history
- Each PR fully reviewed before next
- No complex rebasing

**Cons:**
- Slower (wait for each merge)

### Option 2: Stacked (Advanced)

```
main
  ├── feat/di-lifecycle (PR #0)
      ├── feat/security-hardening (PR #1, base: feat/di-lifecycle)
          ├── feat/reliability (PR #2, base: feat/security-hardening)
```

**Workflow:**
1. Open PR #0 against `main`
2. Create branch from `feat/di-lifecycle`, open PR #1 against `feat/di-lifecycle`
3. When PR #0 merges, rebase PR #1 onto `main`, change base to `main`

**Pros:**
- Parallel work on multiple layers
- Faster overall delivery

**Cons:**
- Complex rebasing when base PR changes
- Risk of conflicts

**Recommendation:** Use sequential for first few PRs to establish quality baseline.

---

## Emergency Hotfix Workflow

For critical bugs in production:

```bash
# Create hotfix from main
git checkout main
git pull upstream main
git checkout -b hotfix/critical-bug-description

# Fix, test, commit
git commit -m "fix(component): resolve critical issue

Description of the fix.

BREAKING CHANGE: if applicable"

# Push and create PR with "hotfix" label
git push origin hotfix/critical-bug-description
gh pr create --label hotfix
```

Hotfixes skip the pyramid and merge directly to main.

---

## Rebase vs Merge

**Use Rebase for:**
- Local branch updates from main
- Keeping feature branch up-to-date
- Clean, linear history

**Use Merge for:**
- Never (use squash merge on GitHub)

**Commands:**
```bash
# Update branch from main (rebase)
git fetch upstream
git rebase upstream/main

# If conflicts
git rebase --continue  # after resolving
git rebase --abort     # to cancel
```

---

## Useful Aliases (Optional)

Add to `~/.gitconfig`:

```ini
[alias]
  # Workflow shortcuts
  sync = "!git fetch upstream && git rebase upstream/main"
  pushf = push --force-with-lease

  # Amend without editing message
  fix = commit --amend --no-edit

  # Pretty log
  lg = log --oneline --graph --decorate --all
  lga = log --oneline --graph --decorate --all --abbrev-commit

  # Show files changed in last commit
  changed = diff-tree --no-commit-id --name-only -r HEAD
```

**Usage:**
```bash
# Sync with upstream
git sync

# Make changes and amend to existing commit
git add .
git fix

# Force push safely
git pushf
```

**Note:** No need for commit message helpers - write comprehensive messages manually.

---

## Tools & Automation

### Recommended Tools

1. **GitHub CLI** - Create PRs from terminal (ESSENTIAL)
   ```bash
   gh pr create
   gh pr list
   gh pr checkout 42
   gh pr merge --rebase  # Use rebase merge for single commits
   ```

2. **Husky** - Git hooks (OPTIONAL)
   ```bash
   npm install --save-dev husky
   npx husky install
   ```

3. **Text Editor** - Write comprehensive commit messages
   - Use `git commit` (opens editor) instead of `git commit -m`
   - This allows multi-line messages with proper formatting

**Note:** Skip Commitizen/Commitlint - they're designed for atomic commits which we avoid.

### Pre-commit Hook Example

`.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pre-commit checks..."

# Run tests
npm test || {
  echo "❌ Tests failed. Fix before committing."
  exit 1
}

# Run build
npm run build || {
  echo "❌ Build failed. Fix TypeScript errors."
  exit 1
}

echo "✅ All checks passed!"
```

**Note:** This ensures you never commit broken code.

---

## Current Status

### Completed
- ✅ DI Lifecycle implementation
- ✅ SSOT documentation v2.1.0
- ✅ Test infrastructure (99.2% passing)
- ✅ Single comprehensive commit created

### Commit Summary

```
bd102dc feat(di): consolidate database connections under DI container
  30 files changed, 1707 insertions(+), 126 deletions(-)
  - Implementation: 5 source files
  - Testing: 3 test files + helper
  - Documentation: 4 SSOT/plan docs
  - Build: 18 compiled files
```

### Next Steps (In Order)

1. **Push and create PR #0**
   ```bash
   git push origin feat/di-lifecycle
   gh pr create --title "feat: consolidate database connections under DI container"
   ```

2. **After PR #0 merges, start PR #1 (Security)**
   ```bash
   git checkout master
   git pull upstream master
   git checkout -b feat/security-hardening

   # Work on security layer...
   # When done, create ONE comprehensive commit
   git add .
   git commit -m "feat(security): ..."
   ```

---

## Related Documents

- `ssot_unitai_architecture_2026-01-24.md` - System architecture
- `plan_unitai_di_2026-01-24.md` - DI implementation plan
- `plan_unitai_di_2026-01-24.md` - This workflow guide
