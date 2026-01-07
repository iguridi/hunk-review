# Reviewed Patch

A CLI tool for interactive review of diff patches with persistent tracking. Navigate through hunks and mark them as reviewed - reviewed hunks are automatically filtered out in subsequent sessions.

## Features

- **Hunk-based Navigation**: Navigate through entire hunks instead of individual lines
- **Persistent Tracking**: Reviews are saved and persist across sessions
- **Content-based Hashing**: Hunks stay reviewed even if moved to different files
- **Interactive TUI**: Keyboard-driven interface similar to tig/lazygit
- **Portable**: Works across branches, rebases, and different files

## Installation

```bash
bun install
bun run build
```

## Usage

```bash
# Review from stdin
git diff main...feature | reviewed-patch

# Review from file
reviewed-patch --file changes.patch

# Review staged changes
git diff --cached | reviewed-patch

# Show statistics
reviewed-patch --stats

# Reset all reviews (all sessions)
reviewed-patch --reset

# Reset reviews for current session only (current branch)
reviewed-patch --reset-session
```

## Key Bindings

- `↑/k` - Previous unreviewed hunk
- `↓/j` - Next unreviewed hunk
- `Space` - Mark current hunk as reviewed
- `a` - Mark all hunks in current file
- `u` - Unmark current hunk
- `r` - Reset file reviews
- `?` - Show help
- `q/Esc` - Quit

## How It Works

### Content-Based Hashing

Each hunk is hashed based on its content (all added/deleted lines). The hash is stored when you mark a hunk as reviewed. On subsequent runs, hunks with matching hashes are automatically marked as reviewed and can be filtered from view.

### Session-Based Tracking

Reviews are scoped to sessions defined as `{repoName}:{branchName}`. This means:

- **Same branch**: Reviewed hunks are automatically hidden
- **Different branch**: All hunks appear as unreviewed (fresh start)
- **Switch back**: Previous reviews on that branch are restored

Example:
```bash
# On main branch - review some hunks
git checkout main
git diff | reviewed-patch
# Mark hunks 1, 2, 3

# Switch to feature branch - fresh view
git checkout feature
git diff | reviewed-patch
# All hunks show as unreviewed

# Switch back to main - reviews restored
git checkout main
git diff | reviewed-patch
# Hunks 1, 2, 3 are still marked as reviewed
```

### Resetting Reviews

- `--reset`: Clears ALL reviews across ALL sessions (global reset)
- `--reset-session`: Clears reviews ONLY for your current branch (other branches unaffected)

## Development

```bash
# Run in development mode
bun run dev < sample.diff

# Build
bun run build

# Test
bun test
```

## License

MIT
