# Session-Based Hunk Filtering ✅

## Feature

Reviewed hunks are now automatically filtered out and don't reappear when viewing the same diff in the same session (repo + branch).

## Implementation

### Code Changes

**Modified**: [src/index.ts](src/index.ts:77)

Added automatic filtering of reviewed hunks before showing the TUI:

```typescript
// Filter to only show unreviewed hunks
processedDiff = processor.filterUnreviewed(processedDiff);
```

This uses the existing `DiffProcessor.filterUnreviewed()` method to remove already-reviewed hunks from the display.

### How It Works

1. **Parse diff**: Extract all hunks
2. **Check review state**: For each hunk, check if reviewed in current session
3. **Filter**: Remove reviewed hunks from the display
4. **Show TUI**: Only unreviewed hunks are visible

### Session Detection

Sessions are defined as `{repoName}:{branchName}`:
- Same repo, same branch = same session = reviewed hunks hidden
- Same repo, different branch = different session = all hunks visible
- Different repo = different session = all hunks visible

## User Experience

### Before (Bug)
```bash
$ git diff | reviewed-patch
# Shows 3 hunks
# Mark hunk 1 with Space

$ git diff | reviewed-patch
# Shows 3 hunks again (including hunk 1) ❌
# Hunk 1 has a green checkmark but is still visible
# Confusing - did I already review this?
```

### After (Fixed)
```bash
$ git diff | reviewed-patch
Session: my-repo (main)
# Shows 3 hunks
# Mark hunk 1 with Space

$ git diff | reviewed-patch
Session: my-repo (main)
# Shows 2 hunks (hunk 1 is hidden) ✅
# Only unreviewed hunks visible
# Mark hunk 2

$ git diff | reviewed-patch
Session: my-repo (main)
# Shows 1 hunk (hunks 1 and 2 hidden) ✅
# Mark hunk 3

$ git diff | reviewed-patch
Session: my-repo (main)
All hunks have been reviewed!
Total: 3 hunks
# App exits - nothing left to review ✅
```

### Cross-Branch Behavior
```bash
$ git checkout main
$ git diff | reviewed-patch
Session: my-repo (main)
# Mark hunks 1, 2, 3

$ git checkout feature-branch
$ git diff | reviewed-patch
Session: my-repo (feature-branch)
# Shows all hunks (different session) ✅

$ git checkout main
$ git diff | reviewed-patch
Session: my-repo (main)
All hunks have been reviewed!
# Previous reviews on main are remembered ✅
```

## E2E Test Coverage

Added test: **"should not show reviewed hunks when viewing diff a second time in same session"**

This test:
1. Marks first hunk in run 1
2. Launches TUI in run 2 → verifies hunk 1 is filtered out
3. Marks second hunk in run 2
4. Launches TUI in run 3 → verifies hunks 1 and 2 are filtered out

Test validates:
- ✅ Reviewed hunks don't reappear
- ✅ Session tracking works correctly
- ✅ Multiple sequential runs filter progressively
- ✅ Storage persists between runs

## Exit Behavior

When all hunks are reviewed:
```bash
$ git diff | reviewed-patch
Session: my-repo (main)
All hunks have been reviewed!
Total: 3 hunks
```

The app exits gracefully instead of showing an empty TUI.

## Storage Example

After reviewing hunks in session "my-repo:main":

```json
{
  "version": "1.0.0",
  "reviewedHunks": {
    "hash1": {
      "sessions": ["my-repo:main"],
      ...
    },
    "hash2": {
      "sessions": ["my-repo:main"],
      ...
    }
  },
  "sessions": {
    "my-repo:main": {
      "sessionId": "my-repo:main",
      "repoName": "my-repo",
      "branchName": "main",
      "reviewedHashes": ["hash1", "hash2"],
      "lastUpdated": "2026-01-07T..."
    }
  }
}
```

## Benefits

1. **Faster review workflow**: Don't waste time seeing already-reviewed hunks
2. **Progressive review**: Can review large diffs in multiple sessions
3. **Resume capability**: Come back later and only see new/unreviewed hunks
4. **Branch isolation**: Each branch maintains separate review state
5. **Clear progress**: "All hunks reviewed" message when done

## Related Features

This filtering works in conjunction with:
- Session tracking ([src/utils/git.ts](src/utils/git.ts))
- Review storage ([src/storage/ReviewStore.ts](src/storage/ReviewStore.ts))
- Diff processing ([src/diff/processor.ts](src/diff/processor.ts))

## Testing

Run the specific test:
```bash
bun test -t "should not show reviewed hunks when viewing diff a second time"
```

Or all E2E tests:
```bash
bun test tests/e2e-tui.test.ts
```

## Status

✅ **Implemented and tested**
- Code changes: 1 line added
- Tests: 1 new E2E test (11 total E2E tests)
- All 20 tests passing
