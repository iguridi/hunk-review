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

# Reset all reviews
reviewed-patch --reset
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

Each hunk is hashed based on its content (all added/deleted lines). The hash is stored when you mark a hunk as reviewed. On subsequent runs, hunks with matching hashes are automatically marked as reviewed and can be filtered from view.

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
