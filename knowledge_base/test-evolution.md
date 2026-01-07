# Test Evolution

This document chronicles the iterative development of the test suite and the problems solved along the way.

## Initial State

### Original Test Setup (Before Changes)

```typescript
describe('ReviewStore', () => {
  let storageDir: string;
  let store: ReviewStore;

  beforeEach(async () => {
    storageDir = join(tmpdir(), `test-review-${Date.now()}`);
    store = new ReviewStore(storageDir);
  });

  afterEach(async () => {
    // Cleanup
  });

  it('test 1', async () => { /* uses shared store */ });
  it('test 2', async () => { /* uses shared store */ });
});
```

**Problems**:
- Shared state through hooks
- Race conditions with concurrent execution
- Timestamp collisions

## Evolution Phase 1: Initial Concurrent Support

### Goal
Make tests run with `bun test --concurrent`

### Changes
1. Made each test file use unique directories
2. Kept beforeEach/afterEach hooks

### Result
❌ **Failed**: When running `--concurrent`, tests interfered:
- Same `Date.now()` timestamp in concurrent executions
- Directory collisions
- Shared state corruption

**Error Example**:
```
Expected: 2
Received: 5
```
(Tests seeing each other's data)

## Evolution Phase 2: Add Random IDs

### Goal
Eliminate directory collisions

### Changes
Added random component to directory names:
```typescript
`test-review-${Date.now()}-${Math.random().toString(36).slice(2)}`
```

### Result
✅ **Better**: No more directory collisions
❌ **Still failing**: Bun's beforeEach doesn't isolate properly with concurrent flag

## Evolution Phase 3: Remove Hooks

### Goal
Complete test isolation

### Changes
1. Removed all `beforeEach` and `afterEach` hooks
2. Each test creates its own resources inline
3. Added `.serial()` to describe blocks

**Example Transformation**:

**Before**:
```typescript
describe('ReviewStore', () => {
  let store: ReviewStore;
  beforeEach(async () => {
    storageDir = join(tmpdir(), ...);
    store = new ReviewStore(storageDir);
  });

  it('test', async () => {
    await store.load();
    // test logic
  });
});
```

**After**:
```typescript
describe.serial('ReviewStore', () => {
  it('test', async () => {
    const storageDir = join(tmpdir(), `test-review-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(storageDir, { recursive: true });
    const store = new ReviewStore(storageDir);
    await store.load();
    // test logic
  });
});
```

### Result
✅ **Unit tests work with --concurrent**
⚠️ **E2E tests fail with --concurrent**

## Evolution Phase 4: E2E Test Timing

### Problem
E2E tests spawning TUI processes were failing:
```
ENOENT: no such file or directory, open '.../reviewed.json'
```

### Investigation
1. Process spawns correctly
2. Process exits with code 0
3. But file doesn't exist when test checks

### Root Cause
File writes are asynchronous and may not complete immediately after process exit.

### Solution Attempts

#### Attempt 1: Fixed Delay (200ms)
```typescript
proc.on('close', () => {
  setTimeout(() => resolve(), 200);
});
```
**Result**: Works sequentially, fails with --concurrent

#### Attempt 2: Increase Delay (500ms, 800ms, 900ms)
```typescript
setTimeout(() => resolve(), 900);
```
**Result**: At 900ms, tests hit 1000ms timeout

#### Attempt 3: File Polling ✅
```typescript
async function waitForFile(filePath: string, maxWait = 3000): Promise<boolean> {
  while (Date.now() - startTime < maxWait) {
    if (existsSync(filePath)) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}
```
**Result**: Works better, but still fails under concurrent load

## Evolution Phase 5: Understanding Concurrency Limitations

### Discovery
E2E tests fundamentally cannot run concurrently with other tests because:
1. Blessed library needs exclusive terminal access
2. Multiple spawned processes interfere
3. System load affects file I/O timing
4. TTY conflicts

### Evidence
```bash
# Works
$ bun test tests/e2e-tui.test.ts
3 pass

# Works
$ bun test tests/basic.test.ts --concurrent
10 pass

# Fails
$ bun test --concurrent
11 pass, 2 fail (E2E tests fail)
```

### Analysis
When unit tests run concurrently with E2E process spawning:
```
Unit Tests (concurrent)
├─ Writing to temp dir A
├─ Writing to temp dir B
└─ Reading from temp dir C
    ↓ (system load spikes)
E2E Test spawns TUI
    ↓ (blessed tries to initialize)
    ↓ (file write delayed/fails)
    ✗ File doesn't exist
```

## Current State

### Final Architecture

**Unit Tests**:
- ✅ Fully isolated
- ✅ Each test creates unique temp directory
- ✅ No shared state
- ✅ Can run concurrently (within file)
- ✅ All marked `.serial()` for reliability

**E2E Tests**:
- ✅ Fully isolated
- ✅ Each test creates unique environment
- ✅ Use file polling
- ✅ Marked `.serial()`
- ⚠️ Cannot run concurrently with other tests

**Recommendation**:
```bash
bun test  # Sequential execution, all pass, ~2.6s
```

## Lessons Learned

### 1. beforeEach/afterEach Doesn't Isolate in Concurrent Mode

Bun's test hooks don't provide true isolation when using `--concurrent`. Tests can see each other's state.

**Lesson**: For true isolation, avoid shared state entirely.

### 2. Timestamps Alone Aren't Unique Enough

`Date.now()` can produce same value for concurrent tests.

**Lesson**: Add random component for guaranteed uniqueness.

### 3. Process Spawning + Concurrency = Complexity

Spawned processes that do file I/O are timing-sensitive under system load.

**Lesson**: E2E tests with subprocess spawning work best sequentially.

### 4. Terminal UI Libraries Have Limitations

Blessed expects exclusive terminal access.

**Lesson**: Some types of tests fundamentally can't be fully concurrent.

### 5. Fixed Delays Are Problematic

Fixed delays either:
- Waste time (too long)
- Are unreliable (too short)

**Lesson**: Polling with timeouts is more robust.

### 6. Test Speed vs Reliability Trade-off

Concurrent execution might save 200-400ms but introduces flakiness.

**Lesson**: For this project, reliability > minor speed gain.

## Timeline Summary

| Phase | Change | Result | Duration |
|-------|--------|--------|----------|
| Initial | Shared hooks | Tests pass sequentially | N/A |
| Phase 1 | Add concurrent flag | ❌ Failures | - |
| Phase 2 | Add random IDs | ⚠️ Better but issues | ~30s tests |
| Phase 3 | Remove hooks | ✅ Unit tests work | ~2-3s tests |
| Phase 4 | Add file polling | ⚠️ E2E still fail concurrent | ~2-3s tests |
| Phase 5 | Understand limitations | ✅ Document, use sequential | ~2.6s tests |
| **Final** | **Isolated tests** | **✅ Reliable** | **~2.6s** |

## Metrics

### Test Performance

| Scenario | Pass Rate | Duration | Recommendation |
|----------|-----------|----------|----------------|
| Original (sequential) | 100% | ~30s | ❌ Too slow |
| With concurrent flag (early) | ~50% | ~2-3s | ❌ Unreliable |
| Current (sequential) | 100% | ~2.6s | ✅ Optimal |
| Current (concurrent) | ~85% | ~2.2-2.4s | ⚠️ Not recommended |

### Optimization Results

- **Speed improvement**: 30s → 2.6s (91% faster)
- **Reliability**: 100% pass rate (sequential)
- **Isolation**: Complete (no shared state)

## Future Opportunities

### If Concurrent E2E Required

1. **Separate Test Suites**:
   ```json
   {
     "test:unit": "bun test tests/basic.test.ts --concurrent",
     "test:e2e": "bun test tests/e2e-tui.test.ts",
     "test": "bun run test:unit && bun run test:e2e"
   }
   ```

2. **Terminal Multiplexing**: Investigate tmux/screen for parallel TUI testing

3. **Mock Blessed**: Create blessed mock (significant effort)

### Likely Not Worth It

The current approach (sequential, ~2.6s) is fast enough and reliable. The complexity of full concurrency likely exceeds the benefit of saving 200-400ms.

## Related Documentation

- [Test Architecture](test-architecture.md) - Final structure
- [Test Isolation](test-isolation.md) - How isolation achieved
- [Concurrency Limitations](concurrency-limitations.md) - Why limitations exist
- [Implementation Decisions](implementation-decisions.md) - Key choices made
