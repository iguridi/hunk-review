# Quick Reference

Fast lookup for common test-related information.

## Running Tests

```bash
# Recommended: Sequential execution
bun test

# Alternative: Concurrent (has limitations)
bun test --concurrent

# Run specific file
bun test tests/basic.test.ts
bun test tests/e2e-tui.test.ts

# Run specific test
bun test -t "should save and load reviews"

# Watch mode
bun test --watch
```

## Test Results

| Command | Result | Duration |
|---------|--------|----------|
| `bun test` | ✅ 13 pass, 0 fail | ~2.6s |
| `bun test --concurrent` | ⚠️ ~11 pass, 2 fail | ~2.2-2.4s |

## Test Breakdown

```
Total: 13 tests, 35 expect() calls

Unit Tests (basic.test.ts) - 10 tests
├─ ContentHasher (2 tests)
├─ DiffParser (2 tests)
├─ ReviewStore (4 tests)
└─ DiffProcessor (2 tests)

E2E Tests (e2e-tui.test.ts) - 3 tests
└─ TUI Tests (3 tests)
```

## File Locations

```
tests/
├─ basic.test.ts       # Unit tests (10 tests)
└─ e2e-tui.test.ts     # E2E tests (3 tests)

knowledge_base/
├─ README.md                     # Overview
├─ test-architecture.md          # Structure
├─ test-isolation.md             # Isolation strategy
├─ e2e-testing.md                # E2E details
├─ concurrency-limitations.md    # Why --concurrent fails
├─ file-operations.md            # File I/O details
├─ implementation-decisions.md   # Key decisions
├─ test-evolution.md             # Development history
├─ code-verification.md          # Code cross-check
└─ quick-reference.md            # This file
```

## Key Code Patterns

### Create Isolated Test Environment

```typescript
const storageDir = join(
  tmpdir(),
  `test-review-${Date.now()}-${Math.random().toString(36).slice(2)}`
);
await mkdir(storageDir, { recursive: true });
const store = new ReviewStore(storageDir);
await store.load();
```

### Wait for File to Exist

```typescript
const fileExists = await waitForFile(storagePath);
expect(fileExists).toBe(true);
```

### Spawn TUI Process

```typescript
const { diffFile, storageDir } = await createTestEnv();
await runTUICommand(diffFile, storageDir, [' ', ' ', 'q']);
```

## Configuration Values

```typescript
// E2E Test Timeouts
const TIMEOUT = 1000;              // 1 second max per test
const POST_CLOSE_DELAY = 100;      // After process closes
const WAIT_FOR_FILE_MAX = 100;     // File polling timeout
const POLL_INTERVAL = 50;          // Check every 50ms
const EXTRA_DELAY = 100;           // After file detected

// Keystroke Timing
const INITIAL_DELAY = 50;          // Before first keystroke
const KEYSTROKE_INTERVAL = 20;     // Between keystrokes
```

## Common Issues

### Issue: Tests Pass Alone, Fail Together

**Symptom**: `bun test tests/e2e-tui.test.ts` passes, but `bun test` fails
**Cause**: Concurrent execution with --concurrent flag
**Solution**: Run `bun test` (without --concurrent)

### Issue: ENOENT File Not Found

**Symptom**: `ENOENT: no such file or directory, open '.../reviewed.json'`
**Cause**: TUI process didn't write file (concurrent interference)
**Solution**: Ensure sequential execution

### Issue: Test Timeout

**Symptom**: `Command timed out after 1000ms`
**Cause**: Process hung or very slow
**Solution**: Check TUI implementation, verify process completes

### Issue: Shared State Between Tests

**Symptom**: Test sees data from another test
**Cause**: beforeEach/afterEach hooks with concurrent flag
**Solution**: Remove hooks, create resources inline (already done)

## Debugging

### Check File System

```typescript
console.log('Storage path:', storagePath);
console.log('File exists?', existsSync(storagePath));
console.log('Directory:', readdirSync(dirname(storagePath)));
```

### Check Process Output

```typescript
console.log('Process output:', output);
console.log('Process error:', errorOutput);
```

### Verify Timing

```typescript
const start = Date.now();
await runTUICommand(...);
console.log('Duration:', Date.now() - start);
```

## Cheat Sheet

| Want to... | Command/Pattern |
|------------|-----------------|
| Run all tests | `bun test` |
| Run one file | `bun test tests/basic.test.ts` |
| Run one test | `bun test -t "test name"` |
| Debug a test | Add `console.log()`, run single test |
| Add new test | Create inline, unique temp dir, `.serial()` |
| Verify isolation | Each test should work alone with `-t` |

## Testing Checklist

When adding new tests:

- [ ] Test creates unique temp directory
- [ ] Test is in `.serial()` describe block
- [ ] No shared variables with other tests
- [ ] No beforeEach/afterEach dependencies
- [ ] Test works alone: `bun test -t "test name"`
- [ ] Test works with others: `bun test`
- [ ] If E2E: Uses `waitForFile()` for file checks
- [ ] If E2E: Has reasonable timeout

## Performance

```
Test Type         | Count | Avg Duration | Total
------------------|-------|--------------|-------
ContentHasher     | 2     | <1ms         | ~2ms
DiffParser        | 2     | <1ms         | ~2ms
ReviewStore       | 4     | ~1-2ms       | ~8ms
DiffProcessor     | 2     | ~1-2ms       | ~4ms
E2E TUI Tests     | 3     | ~850ms       | ~2.5s
------------------|-------|--------------|-------
Total             | 13    | ~200ms avg   | ~2.6s
```

## Further Reading

- [Test Architecture](test-architecture.md) - Detailed structure
- [Test Isolation](test-isolation.md) - How isolation works
- [E2E Testing](e2e-testing.md) - Process spawning details
- [Concurrency Limitations](concurrency-limitations.md) - Full explanation
- [Test Evolution](test-evolution.md) - Development history

## Contact

For questions about the test architecture, refer to the detailed documentation in this knowledge_base folder.
