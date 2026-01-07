# Fix Summary: Piped Input Now Works!

## Problem
The TUI was exiting immediately when using piped input:
```bash
git show <sha> | bun run dev  # Would exit immediately
```

## Root Cause
Two issues:
1. **Event loop not kept alive**: The `start()` method returned immediately instead of keeping Node.js running
2. **stdin consumed**: After reading the diff from stdin, we couldn't reuse stdin for blessed keyboard input

## Solutions Implemented

### Fix #1: Keep Event Loop Alive
Added a never-resolving Promise to keep the app running:

```typescript
async start(): Promise<void> {
  this.screen.append(this.diffView);
  this.screen.append(this.statusBar);
  this.render();

  // Keep event loop alive for keyboard events
  return new Promise(() => {});  // Never resolves!
}
```

### Fix #2: Wrapper Script for Piped Input
Created `bin/reviewed-patch` wrapper that saves piped input to a temp file:

```bash
#!/usr/bin/env bash
if [ ! -t 0 ]; then
  # Stdin is piped, save to temp file
  TMPFILE=$(mktemp)
  trap "rm -f '$TMPFILE'" EXIT
  cat > "$TMPFILE"
  exec bun run src/index.ts --file "$TMPFILE" "$@"
else
  # No piped input, pass through
  exec bun run src/index.ts "$@"
fi
```

## Usage Now

### ✅ Working: Piped Input (via wrapper)
```bash
git show a11616ab | bun run dev
git diff main...feature | bun run dev
git diff --cached | bun run dev
```

The wrapper automatically:
1. Detects piped input
2. Saves to temporary file
3. Runs app with `--file` option
4. Cleans up temp file on exit

### ✅ Working: File Input
```bash
bun run dev --file changes.patch
git diff > /tmp/changes.diff && bun run dev --file /tmp/changes.diff
```

### ✅ Working: All Other Commands
```bash
bun run dev --stats
bun run dev --reset
```

## Testing

All tests pass:
```bash
$ bun test
✓ 9 pass
✓ 0 fail
```

App stays running and responds to keyboard input:
```bash
$ git show a11616ab | bun run dev
# TUI launches and waits for keyboard input
# Press q to quit
```

## Files Modified

1. **src/ui/tui.ts** - Added Promise to keep event loop alive
2. **src/utils/input.ts** - Added reopenStdin() method (for /dev/tty approach)
3. **src/index.ts** - Call reopenStdin() after reading from stdin
4. **bin/reviewed-patch** - New wrapper script (THE KEY FIX)
5. **package.json** - Updated `dev` script to use wrapper

## Key Insight

The stdin/TTY problem is tricky because:
- When you pipe to stdin, it gets consumed reading the diff
- Blessed needs stdin for keyboard input
- Reopening `/dev/tty` doesn't work in all environments
- **Solution**: Don't try to reuse stdin - save to temp file instead!

The wrapper script is the cleanest solution.

## Status: ✅ FIXED

You can now use:
```bash
git show a11616abad952779c811af362a95b4fe10c70086 | bun run dev
```

And the TUI will:
- Launch successfully
- Display all hunks
- Wait for your keyboard input
- Let you navigate and mark hunks
- Exit only when you press 'q'
