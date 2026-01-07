# Implementation Decisions

This document records key architectural decisions and their rationale.

## Test Isolation Strategy

### Decision: Remove beforeEach/afterEach Hooks

**Date**: Session work
**Context**: Tests were sharing state through hooks when attempting concurrent execution

**Alternatives Considered**:
1. Keep hooks, fix concurrent issues with locks
2. Use test.serial() for all tests
3. Remove hooks entirely ✅

**Chosen**: Remove hooks entirely

**Rationale**:
- Bun's `beforeEach` doesn't isolate properly with `--concurrent`
- Hooks create implicit dependencies
- Inline resource creation is more explicit
- Each test is self-contained and readable

**Trade-offs**:
- ✅ Better: Perfect isolation, no hidden dependencies
- ✅ Better: Each test explicitly shows what it needs
- ❌ Worse: More boilerplate per test
- ❌ Worse: Can't DRY up common setup

**Verdict**: The explicitness and isolation benefits outweigh the boilerplate cost.

---

## Unique Directory Generation

### Decision: Use Date.now() + Random String

**Pattern**: `` `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}` ``

**Context**: Need unique directories for each test to prevent interference

**Alternatives Considered**:
1. UUID library (adds dependency)
2. Counter-based (requires shared state)
3. Date.now() only (collision risk with concurrent tests)
4. Date.now() + random ✅

**Chosen**: Date.now() + random

**Rationale**:
- No external dependencies
- Effectively zero collision probability for test suite size
- Sortable by time (aids debugging)
- Human-readable
- Works with concurrent execution

**Example**:
```
test-review-1767806986507-la05gvxvxko
              ^timestamp    ^random
```

**Collision Probability**:
- Same millisecond: Possible with concurrent tests
- Same random string: 1 in 2,821,109,907,456 (36^10)
- Both: Negligible

---

## E2E Test Timing

### Decision: Polling with waitForFile()

**Context**: File writes after process exit may not be immediate

**Alternatives Considered**:
1. Fixed delay (e.g., always wait 500ms)
2. Poll with short timeout ✅
3. Watch file system events
4. No wait (immediate check)

**Chosen**: Poll with short timeout

**Rationale**:
- Faster than fixed delay in success case
- Configurable timeout for different scenarios
- Simple implementation
- Clear success/failure indication

**Implementation**:
```typescript
async function waitForFile(filePath: string, maxWait = 100): Promise<boolean> {
  const startTime = Date.now();
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

**Parameters**:
- Poll interval: 50ms (not too aggressive)
- Extra delay: 100ms (ensures write completion)
- Default timeout: 100ms (may need adjustment)

---

## Serial vs Concurrent Execution

### Decision: Recommend Sequential, Support Limited Concurrency

**Context**: E2E tests with subprocess spawning can't reliably run concurrently

**Alternatives Considered**:
1. Force all tests sequential
2. Support full concurrency ✅ (attempted but failed for E2E)
3. Separate test commands (unit vs E2E)
4. Document limitations ✅ (chosen)

**Chosen**: Support both, document limitations

**Implementation**:
- All describe blocks marked `.serial()`
- Tests isolated with unique directories
- Documentation explains why concurrent E2E fails

**Result**:
- `bun test`: ✅ Works reliably (~2.6s)
- `bun test --concurrent`: ⚠️ E2E tests may fail

**Rationale**:
- Honest about limitations
- Sequential execution is reliable
- Marginal concurrency speedup not worth reliability risk
- Unit tests CAN run concurrently (within their file)

---

## Test Environment Cleanup

### Decision: No Explicit Cleanup

**Context**: Tests create temp directories and files

**Alternatives Considered**:
1. afterEach cleanup (removed with hooks)
2. Explicit cleanup at test end
3. No cleanup, rely on OS ✅

**Chosen**: No explicit cleanup

**Rationale**:
- OS automatically cleans `/tmp` periodically
- Unique directories prevent conflicts
- Leftover files aid debugging
- Cleanup adds complexity
- Cleanup can fail and cause test failures

**Trade-offs**:
- ✅ Simpler test code
- ✅ Better debugging (can inspect files after failure)
- ❌ Temp directory accumulation (negligible impact)

---

## Blessed Library Integration

### Decision: Accept Terminal UI Limitations

**Context**: Blessed requires exclusive terminal access, complicates testing

**Alternatives Considered**:
1. Mock blessed (huge undertaking)
2. Use different UI library
3. Accept limitations ✅

**Chosen**: Accept limitations, test with real processes

**Rationale**:
- Blessed is established and works well
- Real E2E tests are more valuable than mocked
- Limitations are well-understood
- Sequential execution is acceptable

**Testing Strategy**:
- Spawn real processes
- Simulate keystrokes via stdin
- Capture output
- Verify file system side effects

---

## Test Timeout Values

### Decision: 1 Second Per Test

**Value**: 1000ms (TIMEOUT constant)

**Context**: E2E tests spawn processes, need reasonable timeout

**Alternatives Considered**:
- 500ms: Too short, tests timeout
- 1000ms: Works for most cases ✅
- 3000ms: Too generous, masks issues
- 5000ms: Far too long

**Chosen**: 1000ms

**Breakdown**:
```
50ms   - Initial delay
N×20ms - Keystroke delay (N keystrokes)
???ms  - Process execution
100ms  - Post-close delay
100ms  - File polling (up to)
100ms  - Write completion delay
------
~350ms + process time
```

**Rationale**:
- Fast enough to catch hangs
- Generous enough for normal execution
- Aligns with test duration expectations

---

## Process Environment Variables

### Decision: Use NODE_ENV=test for Test-Specific Behavior

**Context**: TUI needs to behave differently in tests (output to stderr, etc.)

**Implementation** - [src/ui/tui.ts:317-322](../src/ui/tui.ts#L317-L322):
```typescript
if (process.env.NODE_ENV === 'test') {
  console.error('E2E_TEST_REVIEW_COMPLETE');
  console.error(message);
} else {
  console.log(message);
}
```

**Alternatives Considered**:
1. Separate test build
2. Command-line flag
3. Environment variable ✅

**Chosen**: Environment variable

**Rationale**:
- Standard pattern (NODE_ENV)
- Easy to set in test spawn
- No code duplication
- Clear intent

---

## Summary Table

| Decision | Rationale | Trade-off | Status |
|----------|-----------|-----------|--------|
| Remove hooks | Perfect isolation | More boilerplate | ✅ Good |
| Unique dirs with timestamp+random | No collisions | None | ✅ Good |
| waitForFile() polling | Faster than fixed delay | Extra code | ✅ Good |
| Sequential execution | Reliability over speed | Slower than possible | ✅ Acceptable |
| No cleanup | Simpler, aids debugging | Temp files accumulate | ✅ Acceptable |
| Real process spawning | True E2E testing | Can't fully concurrent | ✅ Acceptable |
| 1s timeout | Balance speed/reliability | None | ✅ Good |
| NODE_ENV=test | Standard pattern | None | ✅ Good |

## Future Considerations

### Potential Improvements

1. **Dynamic Timeout**: Adjust `waitForFile()` timeout based on system load
2. **Separate Test Commands**: `test:unit` concurrent, `test:e2e` sequential
3. **Mock Mode**: Optional blessed mock for faster (but less realistic) tests
4. **Parallel E2E**: Investigate terminal multiplexing for concurrent TUI tests

### Not Recommended

1. ❌ Forcing concurrent E2E tests (unreliable)
2. ❌ Mocking file system (loses realism)
3. ❌ Increasing timeouts significantly (masks problems)

## Related Documentation

- [Test Architecture](test-architecture.md) - Overall structure
- [Test Isolation](test-isolation.md) - How decisions enable isolation
- [Concurrency Limitations](concurrency-limitations.md) - Why some decisions have trade-offs
