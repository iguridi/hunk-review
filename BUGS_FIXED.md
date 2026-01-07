# Bug Fixes

## Bug #1: Viewport Doesn't Follow Hunk Selection

### Problem
When navigating between hunks with ↑/↓, the viewport would not scroll to keep the current hunk visible. Users had to manually scroll to see what they were reviewing.

### Root Cause
The `render()` method was only updating content but not adjusting the scroll position.

### Solution
Added `scrollToCurrentHunk()` method that:
1. Calculates the line number of the current hunk
2. Scrolls the viewport to that position
3. Uses `setImmediate()` to wait for blessed to finish rendering before scrolling

**Modified**: [src/ui/tui.ts](src/ui/tui.ts)

```typescript
private scrollToCurrentHunk(): void {
  let lineNumber = 0;
  let globalHunkIndex = 0;

  for (const file of this.diff.files) {
    lineNumber += 2; // File header + blank line

    for (const processedHunk of file.hunks) {
      if (globalHunkIndex === this.currentHunkIndex) {
        // Scroll after render completes
        setImmediate(() => {
          try {
            this.diffView.setScrollPerc(0);
            this.diffView.setScroll(lineNumber);
            this.screen.render();
          } catch (error) {
            // Ignore scroll errors during initial render
          }
        });
        return;
      }

      lineNumber += 1 + processedHunk.chunk.changes.length + 1;
      globalHunkIndex++;
    }
  }
}
```

### Result
✅ The viewport now automatically scrolls to keep the current hunk visible when navigating.

---

## Bug #2: Reviewed Hunks Show Up Again in Same Session

### Problem
Once you mark a hunk as reviewed, it would be considered "reviewed" globally forever, even when reviewing the same branch later. This made it impossible to re-review changes when they were updated.

### Expected Behavior
Reviewed hunks should only hide **within the current session** (defined as repo name + branch name). Switching branches or reviewing a different repo should show all hunks again.

### Root Cause
The storage only tracked global review status with no concept of sessions.

### Solution

#### 1. Created Session Detection ([src/utils/git.ts](src/utils/git.ts))
New `GitHelper` class that:
- Detects if in a git repository
- Extracts repo name from remote origin URL
- Gets current branch name
- Creates session ID: `{repoName}:{branchName}`

```typescript
export class GitHelper {
  static getCurrentSession(): SessionInfo | null {
    // Finds git root
    // Gets repo name from remote
    // Gets current branch
    // Returns { repoName, branchName, sessionId }
  }
}
```

#### 2. Updated Schema ([src/storage/schema.ts](src/storage/schema.ts))
Added session tracking to data structure:

```typescript
export interface ReviewMetadata {
  firstSeenAt: string;
  lastReviewedAt: string;
  reviewCount: number;
  context?: string;
  sessions: string[]; // NEW: Which sessions reviewed this
}

export interface SessionData {
  sessionId: string;
  repoName: string;
  branchName: string;
  reviewedHashes: string[]; // Hunks reviewed in THIS session
  lastUpdated: string;
}

export interface ReviewData {
  version: string;
  reviewedHunks: Record<string, ReviewMetadata>;
  sessions: Record<string, SessionData>; // NEW
  statistics: { ... };
}
```

#### 3. Updated ReviewStore ([src/storage/ReviewStore.ts](src/storage/ReviewStore.ts))
Modified to support session-aware checking:

```typescript
class ReviewStore {
  private currentSessionId: string | null = null;

  setSession(sessionId: string, repoName: string, branchName: string): void {
    this.currentSessionId = sessionId;
    // Initialize session if new
  }

  hasReviewedHunk(hash: string): boolean {
    // If in a session, only check if reviewed in THIS session
    if (this.currentSessionId) {
      return this.hasReviewedInSession(hash, this.currentSessionId);
    }
    // Otherwise check global
    return hash in this.data.reviewedHunks;
  }

  async markHunkReviewed(hash: string, context?: string): Promise<void> {
    // Update global review data
    // ALSO update session-specific data
    // Track which sessions have reviewed this hunk
  }
}
```

#### 4. Wired Up in Main ([src/index.ts](src/index.ts))
Detect session and configure ReviewStore:

```typescript
// Detect current git session (repo + branch)
const session = GitHelper.getCurrentSession();

const reviewStore = new ReviewStore(options.storageDir);
await reviewStore.load();

// Set session if detected
if (session) {
  reviewStore.setSession(session.sessionId, session.repoName, session.branchName);
  console.log(`Session: ${session.repoName} (${session.branchName})`);
}
```

### How It Works

**First time reviewing on `main` branch:**
```bash
$ git diff | bin/reviewed-patch
Session: reviewed-patch (main)
# Shows all hunks as unreviewed
# Mark some hunks
# They're saved to session "reviewed-patch:main"
```

**Review again on same branch:**
```bash
$ git diff | bin/reviewed-patch
Session: reviewed-patch (main)
# Previously reviewed hunks are hidden! ✅
```

**Switch to feature branch:**
```bash
$ git checkout feature-branch
$ git diff | bin/reviewed-patch
Session: reviewed-patch (feature-branch)
# All hunks show as unreviewed (different session) ✅
```

**Switch back to main:**
```bash
$ git checkout main
$ git diff | bin/reviewed-patch
Session: reviewed-patch (main)
# Hunks reviewed earlier on main are still marked ✅
```

### Data Storage Example

```json
{
  "version": "1.0.0",
  "reviewedHunks": {
    "abc123...": {
      "firstSeenAt": "2026-01-07T08:00:00Z",
      "lastReviewedAt": "2026-01-07T08:05:00Z",
      "reviewCount": 1,
      "context": "@@ -10,6 +10,8 @@",
      "sessions": ["reviewed-patch:main"]
    }
  },
  "sessions": {
    "reviewed-patch:main": {
      "sessionId": "reviewed-patch:main",
      "repoName": "reviewed-patch",
      "branchName": "main",
      "reviewedHashes": ["abc123..."],
      "lastUpdated": "2026-01-07T08:05:00Z"
    },
    "reviewed-patch:feature-branch": {
      "sessionId": "reviewed-patch:feature-branch",
      "repoName": "reviewed-patch",
      "branchName": "feature-branch",
      "reviewedHashes": [],
      "lastUpdated": "2026-01-07T08:10:00Z"
    }
  }
}
```

### Result
✅ Reviewed hunks now only hide within the same repo+branch session
✅ Switching branches shows all hunks again
✅ Switching back to a branch restores the review state
✅ Global review history is still maintained for statistics

---

## Testing

Both fixes tested and working:

```bash
$ bun test
✓ 9 pass
✓ 0 fail

$ bin/reviewed-patch --file /tmp/changes.diff
Session: reviewed-patch (main)
# TUI launches successfully
# Viewport scrolls to current hunk ✅
# Session tracking active ✅
```

## Files Modified

1. **src/ui/tui.ts** - Added viewport scrolling
2. **src/utils/git.ts** - NEW: Git session detection
3. **src/storage/schema.ts** - Added session data structures
4. **src/storage/ReviewStore.ts** - Session-aware review checking
5. **src/index.ts** - Wired up session detection

## Backwards Compatibility

✅ Old review data will still load (missing `sessions` field is handled)
✅ No session detection (non-git repos) falls back to global review checking
✅ Existing global review stats preserved
