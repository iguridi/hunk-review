# Testing Guide

## Test Suite Overview

The project includes comprehensive testing at multiple levels:

- **Unit Tests**: 9 tests covering core functionality
- **E2E TUI Tests**: 10 tests verifying interactive behavior
- **Total**: 19 tests, all passing ✅

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/basic.test.ts
bun test tests/e2e-tui.test.ts

# Run with timeout (for E2E tests)
bun test --timeout 60000
```

## Test Coverage

### Unit Tests (`tests/basic.test.ts`)

**ContentHasher** (3 tests):
- ✅ Hashes hunks consistently
- ✅ Only includes add/del lines in hash
- ✅ Same changes in different contexts hash identically

**DiffParser** (2 tests):
- ✅ Parses simple unified diffs
- ✅ Throws on empty diff

**ReviewStore** (3 tests):
- ✅ Saves and loads reviews
- ✅ Unmarks hunks
- ✅ Tracks statistics

**DiffProcessor** (2 tests):
- ✅ Processes diff and marks review state
- ✅ Filters unreviewed hunks

### E2E TUI Tests (`tests/e2e-tui.test.ts`)

**Basic Functionality** (3 tests):
- ✅ Launches TUI and displays hunks
- ✅ Navigates between hunks with arrow keys
- ✅ Handles navigation with j/k (vim-style)

**Review Management** (4 tests):
- ✅ Marks hunks as reviewed with space key
- ✅ Persists reviews across sessions
- ✅ Unmarks hunks with u key
- ✅ Auto-advances to next unreviewed hunk after marking

**Session Tracking** (1 test):
- ✅ Tracks session-specific reviews (repo + branch)

**UI Features** (2 tests):
- ✅ Shows help with ? key
- ✅ Handles empty diff gracefully

## E2E Test Architecture

The E2E tests use a helper function that:
1. Spawns the actual TUI process
2. Sends simulated keypresses via stdin
3. Captures output and verifies behavior
4. Checks file system state (review storage)

### Example E2E Test

```typescript
it('should mark hunks as reviewed with space key', async () => {
  // Launch TUI, press space, quit
  await runTUICommand(diffFile, storageDir, [
    ' ',  // Space - mark current hunk
    'q',  // Quit
  ]);

  // Verify storage was created and has reviews
  const storagePath = join(storageDir, 'reviewed.json');
  expect(existsSync(storagePath)).toBe(true);

  const data = JSON.parse(await Bun.file(storagePath).text());
  expect(Object.keys(data.reviewedHunks).length).toBeGreaterThan(0);
});
```

### Key Presses Supported in Tests

- `' '` - Space (mark hunk)
- `'q'` - Quit
- `'u'` - Unmark
- `'?'` - Show help
- `'j'` - Next hunk (vim-style)
- `'k'` - Previous hunk (vim-style)
- `'\x1B[B'` - Down arrow
- `'\x1B[A'` - Up arrow

## Test Data

E2E tests use a sample diff with multiple hunks:

```diff
diff --git a/test1.ts b/test1.ts
--- a/test1.ts
+++ b/test1.ts
@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;
@@ -10,3 +11,4 @@
 function foo() {
+  console.log('test');
   return 42;
 }
diff --git a/test2.ts b/test2.ts
--- a/test2.ts
+++ b/test2.ts
@@ -1,3 +1,4 @@
 const x = 10;
+const y = 20;
 const z = 30;
```

This provides 3 hunks across 2 files for testing navigation and review functionality.

## Test Isolation

Each test:
- Uses a unique temporary directory
- Creates isolated storage
- Cleans up after completion
- Doesn't interfere with other tests

## Running Tests in CI

The test suite is designed to run reliably in CI environments:

```yaml
# Example GitHub Actions
- name: Run tests
  run: bun test --timeout 60000
```

## Debugging Test Failures

If E2E tests fail:

1. **Check timeout**: E2E tests need time for TUI to initialize
   ```bash
   bun test --timeout 60000
   ```

2. **Check output**: Tests capture stdout/stderr
   ```typescript
   console.log('Process output:', output);
   ```

3. **Verify storage**: Check if files are being created
   ```typescript
   console.log('Storage exists:', existsSync(storagePath));
   ```

4. **Run single test**:
   ```bash
   bun test tests/e2e-tui.test.ts -t "should mark hunks"
   ```

## Performance

Test execution times:
- Unit tests: ~100ms
- E2E tests: ~12s (spawns multiple processes)
- Total: ~12s for all 19 tests

## Future Test Improvements

Potential additions:
- Integration tests for CLI commands (--stats, --reset)
- Performance benchmarks for large diffs
- Cross-platform tests (Linux, macOS, Windows)
- Visual regression tests for TUI rendering
- Stress tests with hundreds of hunks

## Test Results

Latest run:
```
$ bun test
✓ 19 pass
✓ 0 fail
✓ 36 expect() calls
Ran 19 tests across 2 files. [12.02s]
```

All tests passing! ✅
