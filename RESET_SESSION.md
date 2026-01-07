# Session Reset Feature

## Overview

The `--reset-session` option allows you to clear reviewed hunks for your current branch only, without affecting reviews in other branches.

## Use Cases

### 1. Force Re-review After Major Changes

When a feature branch gets significant updates and you want to re-review everything on that branch:

```bash
git checkout feature-branch
reviewed-patch --reset-session
git diff | reviewed-patch
# All hunks will appear as unreviewed
```

### 2. Clean Slate for Current Branch

Start fresh on your current branch while preserving review history elsewhere:

```bash
# On feature-x branch
reviewed-patch --reset-session
# Only feature-x reviews are cleared
# Reviews on main, feature-y, etc. are preserved
```

### 3. Mistake Recovery

If you accidentally marked hunks as reviewed on the wrong branch:

```bash
git checkout wrong-branch
reviewed-patch --reset-session
# Clears mistaken reviews on this branch only
```

## Comparison: --reset vs --reset-session

### `--reset` (Global Reset)
- Clears ALL reviews across ALL sessions
- Affects every branch in the repository
- Removes all data from storage
- Use when: Starting completely fresh

```bash
reviewed-patch --reset
# ⚠️  Clears reviews for:
# - main branch
# - feature branches
# - all other branches
```

### `--reset-session` (Branch-Scoped Reset)
- Clears reviews ONLY for current branch
- Other branches remain unaffected
- Selectively removes session data
- Use when: Re-reviewing one specific branch

```bash
# On feature-branch
reviewed-patch --reset-session
# ✅ Clears reviews for: feature-branch
# ✅ Preserves reviews for: main, other branches
```

## How It Works

### Session Identification

Sessions are identified by `{repoName}:{branchName}`:

```bash
# These are different sessions:
my-repo:main          # Session 1
my-repo:feature       # Session 2
my-repo:bugfix        # Session 3
```

### Reset Logic

When you run `--reset-session`:

1. **Identifies current session** based on repo + branch
2. **Removes session** from sessions list
3. **Updates global hunks**:
   - If hunk was reviewed ONLY in this session → delete hunk entirely
   - If hunk was reviewed in OTHER sessions too → remove this session from hunk's session list

### Example Flow

```bash
# Setup: Review same hunk on two branches
git checkout main
# Review hunk abc123
# Storage: hunk abc123 → sessions: ["my-repo:main"]

git checkout feature
# Review hunk abc123 again
# Storage: hunk abc123 → sessions: ["my-repo:main", "my-repo:feature"]

# Reset feature session
git checkout feature
reviewed-patch --reset-session

# Result:
# - hunk abc123 still exists (because reviewed on main)
# - hunk abc123 → sessions: ["my-repo:main"]
# - "my-repo:feature" session deleted
```

## Storage Impact

### Before Reset
```json
{
  "reviewedHunks": {
    "abc123": {
      "sessions": ["my-repo:main", "my-repo:feature"],
      "reviewCount": 2
    },
    "def456": {
      "sessions": ["my-repo:feature"],
      "reviewCount": 1
    }
  },
  "sessions": {
    "my-repo:main": {
      "reviewedHashes": ["abc123"]
    },
    "my-repo:feature": {
      "reviewedHashes": ["abc123", "def456"]
    }
  }
}
```

### After `--reset-session` on feature branch
```json
{
  "reviewedHunks": {
    "abc123": {
      "sessions": ["my-repo:main"],
      "reviewCount": 2
    }
    // def456 is deleted (only in feature)
  },
  "sessions": {
    "my-repo:main": {
      "reviewedHashes": ["abc123"]
    }
    // my-repo:feature session deleted
  }
}
```

## No Session Detected

If you're not in a git repository:

```bash
cd /tmp
reviewed-patch --reset-session
# Output: "No session detected. Use --reset to clear all reviews."
```

## Testing

Run the unit test:

```bash
bun test -t "should reset session reviews only"
```

The test verifies:
- ✅ Session reviews are cleared
- ✅ Other sessions are preserved
- ✅ Global hunks are cleaned up correctly
- ✅ Statistics are updated properly

## CLI Usage

```bash
# Reset current session
reviewed-patch --reset-session

# With custom storage directory
reviewed-patch --reset-session --storage-dir /custom/path

# Display help
reviewed-patch --help
```

## Related Features

- [SESSION_FILTERING.md](SESSION_FILTERING.md) - How session-based filtering works
- [BUGS_FIXED.md](BUGS_FIXED.md#bug-2-reviewed-hunks-show-up-again-in-same-session) - Session tracking implementation details

## Benefits

1. **Granular control**: Reset specific branches without affecting others
2. **Safe**: Can't accidentally lose reviews from other branches
3. **Flexible workflow**: Re-review updated features while keeping main stable
4. **Team collaboration**: Each branch maintains independent review state
