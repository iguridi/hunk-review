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

| Key(s) | Action |
| --- | --- |
| `↓`, `j` | Navigate to the next hunk |
| `↑`, `k` | Navigate to the previous hunk |
| `Space` | Mark the current hunk as reviewed and auto-advance to the next unreviewed one |
| `u` | Unmark the current hunk as reviewed |
| `?` | Show the help screen |
| `q`, `Esc`| Quit the application |

## Workflow

### Review Flow
- When you open a diff, the TUI will display all hunks that have not been reviewed in the current session.
- Use the navigation keys to move between hunks.
- When you mark a hunk as reviewed with `Space`, it is saved to your review store, and the TUI automatically advances to the next unreviewed hunk.
- Hunks that are already reviewed from previous sessions will not be shown.

### Completion
- When all hunks in the diff have been reviewed, the application will automatically exit and display a "All hunks reviewed." message.

### Session-Based Tracking
Reviews are scoped to sessions, which are determined by your current Git branch. This means:
- When you review hunks on a branch, they are tied to that branch's session.
- If you switch to a new branch, you get a fresh review session where no hunks are marked as reviewed.
- If you switch back to a branch you were working on previously, your reviews for that branch are restored.

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
