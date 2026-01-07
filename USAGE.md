# Usage Guide

## Quick Start

```bash
# Review a git diff
git diff | bun run dev

# Review changes between branches
git diff main...feature-branch | bun run dev

# Review from a file
bun run dev --file changes.patch

# Review staged changes
git diff --cached | bun run dev
```

## Key Bindings

| Key | Action |
|-----|--------|
| `↑` or `k` | Navigate to previous hunk |
| `↓` or `j` | Navigate to next hunk |
| `Space` | Mark current hunk as reviewed (auto-advances to next unreviewed) |
| `u` | Unmark current hunk |
| `?` | Show help overlay |
| `q` or `Esc` | Quit application |

## Commands

### Interactive Review

```bash
# Basic usage - pipe a diff
git diff | bun run dev

# From file
bun run dev --file my-changes.patch
```

### Statistics

```bash
# Show review statistics
bun run dev --stats
```

Output:
```
Review Statistics:
  Total reviewed hunks: 42
  Last updated: 2026-01-07T08:00:00.000Z
```

### Reset Reviews

```bash
# Clear all reviewed hunks
bun run dev --reset
```

### Custom Storage Location

```bash
# Use project-specific review database
bun run dev --storage-dir ./.review-db < changes.diff
```

## Workflow Example

1. **Generate a diff:**
   ```bash
   git diff main...feature-branch > review.patch
   ```

2. **Start reviewing:**
   ```bash
   bun run dev --file review.patch
   ```

3. **Navigate and mark hunks:**
   - Use `↓`/`↑` to move between hunks
   - Press `Space` to mark hunks as reviewed
   - Press `q` to quit when done

4. **Resume later:**
   ```bash
   # Already-reviewed hunks remain marked
   bun run dev --file review.patch
   ```

5. **Generate updated diff:**
   ```bash
   # New changes will show as unreviewed
   git diff main...feature-branch > review.patch
   bun run dev --file review.patch
   ```

## Understanding Hunk Tracking

### Content-Based Hashing

Each hunk is hashed based on its content (all added/deleted lines). This means:

- ✅ Hunks stay reviewed even if moved to a different file
- ✅ Works across branches and rebases
- ✅ Portable - not tied to file paths or line numbers
- ⚠️ If any line in a hunk changes, it becomes "unreviewed" again

### Visual Indicators

```
✓  [REVIEWED hunk]    - Green checkmark, hunk has been reviewed
   [UNREVIEWED hunk]  - No checkmark, needs review
>  [Current hunk]     - Inverse/highlighted, your cursor position
```

### Storage

Review data is stored in `~/.reviewed-patch/reviewed.json` by default:

```json
{
  "version": "1.0.0",
  "reviewedHunks": {
    "a3c2f1abc...": {
      "firstSeenAt": "2026-01-07T08:00:00.000Z",
      "lastReviewedAt": "2026-01-07T08:05:00.000Z",
      "reviewCount": 1,
      "context": "@@ -10,6 +10,8 @@ function example()"
    }
  },
  "statistics": {
    "totalReviewedHunks": 1,
    "lastUpdated": "2026-01-07T08:05:00.000Z"
  }
}
```

## Tips

1. **Fast Review**: Press `Space` repeatedly to quickly mark hunks - it auto-advances to the next unreviewed hunk

2. **Per-Project Tracking**: Use `--storage-dir` to keep separate review databases per project

3. **Team Workflow**: Share the review database file with your team for collaborative review tracking

4. **Large Diffs**: The tool handles large diffs efficiently - hunks are the atomic unit, making review faster than line-by-line

5. **Undo Mistakes**: Press `u` to unmark if you accidentally reviewed something

## Troubleshooting

### "No input provided"

You need to either:
- Pipe a diff to stdin: `git diff | bun run dev`
- Use the `--file` option: `bun run dev --file changes.patch`

### "Empty diff provided"

The input contains no changes. Verify your diff has content:
```bash
git diff | wc -l  # Should show > 0 lines
```

### "Failed to parse diff"

The input is not a valid unified diff format. Ensure you're using:
- `git diff` (not `git log`)
- Standard diff format (`diff -u`)

## Building for Production

```bash
# Build the binary
bun run build

# The executable will be at dist/index.js
./dist/index.js --file example.diff

# Or install globally (future):
# bun link
# reviewed-patch < changes.diff
```
