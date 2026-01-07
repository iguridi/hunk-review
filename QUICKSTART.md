# Quick Start Guide

## Try It Now

```bash
# Review changes from a commit
git show <commit-sha> | bun run dev

# Review changes from a branch
git diff main...feature-branch | bun run dev

# Review uncommitted changes
git diff | bun run dev

# Review staged changes
git diff --cached | bun run dev
```

## First Time Usage

1. **Pipe a diff to the tool:**
   ```bash
   git show a11616ab | bun run dev
   ```

2. **The TUI will open showing:**
   - File names and hunk headers in cyan
   - Added lines in green (`+`)
   - Deleted lines in red (`-`)
   - Current hunk highlighted with `>`
   - Review status: `✓` (reviewed) or empty (unreviewed)

3. **Navigate and review:**
   - Press `↓` or `j` to go to next hunk
   - Press `↑` or `k` to go to previous hunk
   - Press `Space` to mark current hunk as reviewed
   - The app auto-advances to the next unreviewed hunk

4. **When done:**
   - Press `q` or `Esc` to quit
   - Your reviews are saved automatically

5. **Review again later:**
   ```bash
   git show a11616ab | bun run dev
   ```
   - Previously reviewed hunks will show with ✓
   - Only unreviewed hunks need attention

## Visual Example

When you run the tool, you'll see:

```
┌─────────────────────────────────────────────────────────┐
│ File: src/example.ts               [2/5 hunks reviewed] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  @@ -10,6 +10,8 @@ function example() {                │
│ >  const foo = bar;                     [UNREVIEWED]    │ ← Current
│ >  return foo + 1;                                      │
│ >+ console.log('debug');                                │
│ >+ const baz = qux;                                     │
│                                                          │
│  @@ -20,3 +22,5 @@ function another() {                │
│ ✓  const x = 1;                         [REVIEWED]      │ ← Reviewed
│ ✓  return x;                                            │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Hunk 1/5 | Reviewed: 2/5 | ↑/↓: Nav  Space: Mark  Q: Quit│
└─────────────────────────────────────────────────────────┘
```

## Key Bindings Cheat Sheet

| Key | Action |
|-----|--------|
| `↓` `j` | Next hunk |
| `↑` `k` | Previous hunk |
| `Space` | Mark as reviewed (auto-advance) |
| `u` | Unmark hunk |
| `?` | Show help |
| `q` `Esc` | Quit |

## Common Workflows

### Code Review Workflow
```bash
# 1. Get PR diff
gh pr diff 123 > pr-123.diff

# 2. Review it
bun run dev --file pr-123.diff

# 3. Resume later (already reviewed hunks skip automatically)
bun run dev --file pr-123.diff

# 4. Check progress
bun run dev --stats
```

### Daily Development
```bash
# Review what you changed today
git diff HEAD~1 | bun run dev

# Review before committing
git diff --cached | bun run dev

# Review branch changes
git diff main...$(git branch --show-current) | bun run dev
```

### Large Refactors
```bash
# Use per-project storage
bun run dev --storage-dir ./.review-state < big-refactor.diff

# Mark hunks as you verify them
# Come back later - progress is saved
```

## Tips

1. **Fast Review**: Just press `Space` repeatedly - it auto-advances
2. **Undo**: Press `u` if you accidentally mark something
3. **Help**: Press `?` anytime to see the help screen
4. **Stats**: Run `bun run dev --stats` to see how many hunks you've reviewed
5. **Reset**: Run `bun run dev --reset` to start fresh

## Troubleshooting

**App exits immediately:**
- Make sure you're piping valid diff output
- Check: `git show <sha> | head` shows diff lines

**No hunks shown:**
- Verify the diff has changes: `git diff | wc -l`
- The app shows "All hunks have been reviewed!" if everything is marked

**Want to reset:**
```bash
bun run dev --reset
```

Ready to review! 🚀
