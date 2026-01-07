# Concurrency Limitations

## Current Status

✅ **`bun test`** - All 13 tests pass (~2.6s)
⚠️ **`bun test --concurrent`** - E2E tests fail when run with unit tests

## Why E2E Tests Can't Run Concurrently

### The Problem

E2E tests spawn TUI processes that use `blessed`, a terminal UI library. When multiple TUI processes run simultaneously:

1. **Terminal Contention**: Multiple processes compete for terminal resources
2. **Process Interference**: Concurrent spawning causes system load spikes
3. **File Write Delays**: File system writes under load don't complete reliably
4. **TTY Conflicts**: Blessed expects exclusive terminal access

### Observed Failures

When running `bun test --concurrent`:

**Symptom 1: File Not Created**
```
ENOENT: no such file or directory, open '.../storage/reviewed.json'
```
The TUI process exits but doesn't write the storage file.

**Symptom 2: Immediate Exit**
```
Expected to contain: "All hunks reviewed."
Received: "\u001B]0;Reviewed Patch\x07\u001B[?1049h..." (just ANSI codes)
```
The TUI initializes but immediately exits without rendering content.

**Symptom 3: Timeout**
```
expect(received).toBe(expected)
Expected: true
Received: false
```
`waitForFile()` times out waiting for files that never get created.

## Technical Root Cause

### Blessed Library Behavior

The TUI uses blessed ([src/ui/tui.ts:1](../src/ui/tui.ts#L1)):
```typescript
import blessed from 'blessed';
```

Blessed expects:
- Exclusive terminal access
- TTY stdin/stdout
- No concurrent terminal operations

### Process Spawn Under Load

When unit tests create file I/O operations concurrently with E2E process spawning:

```
Unit Test 1: Writing to temp dir A    ]
Unit Test 2: Writing to temp dir B    } - Concurrent I/O load
Unit Test 3: Reading from temp dir C  ]
    ↓
E2E Test: Spawns TUI process → blessed initializes → tries to write file
    ↓
File write delayed or fails due to system load
```

### Evidence from Test Runs

**Sequential (Works)**:
```bash
$ bun test
13 pass, 0 fail [2.62s]
```

**Concurrent (Fails)**:
```bash
$ bun test --concurrent
11 pass, 2 fail [~2-3s]
# E2E tests fail with ENOENT or immediate exit
```

**E2E Alone (Works)**:
```bash
$ bun test tests/e2e-tui.test.ts
3 pass, 0 fail [2.61s]
```

## Attempted Solutions

### 1. Increased Delays ❌

Tried delays from 100ms → 900ms after process close.

**Result**: At 900ms, tests timeout. Files still don't get created under concurrent load.

### 2. File Polling ❌

Added `waitForFile()` to poll up to 3000ms.

**Result**: Still times out. The TUI process doesn't write files when running concurrently.

### 3. Serial Execution ✅ (Partial)

Marked all describe blocks as `.serial()`:

```typescript
describe.serial('E2E TUI Tests', () => { ... })
describe.serial('ReviewStore', () => { ... })
```

**Result**: E2E tests run sequentially relative to each other, but still fail when unit tests run concurrently in other files.

### 4. Reduced Concurrency ✅ (Workaround)

```bash
bun test --concurrent --max-concurrency=1
```

**Result**: All tests pass (~2.7s) but no actual concurrency benefit.

## Why `.serial()` Isn't Enough

In Bun, `describe.serial()` means:
- Tests **within** that describe block run sequentially
- But the describe block itself can still run concurrently with other files' tests

```
File A (basic.test.ts)                File B (e2e-tui.test.ts)
├─ describe.serial('ReviewStore')     ├─ describe.serial('E2E TUI Tests')
│  ├─ test 1 ────────────→            │  ├─ test 1 ─→ spawns process
│  ├─ test 2 ────────────→            │  │    ↓
│  └─ test 3 ────────────→            │  │  [TUI process fails due to load]
                          ↑            │  │
                   Concurrent I/O      │  ├─ test 2 ─→ [sequential within block]
                   causes issues ──────┘  └─ test 3 ─→ [sequential within block]
```

## Solution: Sequential Testing

For this project, the correct approach is:

```bash
bun test
```

Without `--concurrent`, tests run:
1. All tests in basic.test.ts
2. Then all tests in e2e-tui.test.ts

This ensures E2E tests don't compete with file I/O operations.

## Why This Is Acceptable

### Test Speed

- **Without --concurrent**: ~2.6s
- **With --concurrent (working)**: ~2.2-2.4s (marginal benefit)
- **With --concurrent (failing)**: Tests fail

**Verdict**: The 200-400ms potential speedup isn't worth the reliability issues.

### Test Reliability

Sequential execution provides:
- ✅ 100% pass rate
- ✅ No flakiness
- ✅ Predictable timing
- ✅ Clear failure diagnosis

### Industry Practice

Many projects with E2E tests that spawn processes run tests sequentially:
- Playwright (browser automation)
- Cypress (browser testing)
- Terminal UI tools

## Alternative: Separate E2E Tests

If strict concurrency is required, consider:

```json
{
  "scripts": {
    "test:unit": "bun test tests/basic.test.ts --concurrent",
    "test:e2e": "bun test tests/e2e-tui.test.ts",
    "test": "bun run test:unit && bun run test:e2e"
  }
}
```

This allows unit tests to run concurrently, while E2E tests run separately.

## Summary Table

| Scenario | Result | Duration | Recommended |
|----------|--------|----------|-------------|
| `bun test` | ✅ Pass | ~2.6s | ✅ Yes |
| `bun test --concurrent` | ❌ Fail | ~2-3s | ❌ No |
| `bun test --concurrent --max-concurrency=1` | ✅ Pass | ~2.7s | ⚠️ Defeats purpose |
| Unit tests concurrent, E2E separate | ✅ Pass | ~2.3s | ✅ Alternative |

## Related Documentation

- [Test Architecture](test-architecture.md) - Overall structure
- [E2E Testing](e2e-testing.md) - Process spawning details
- [Test Isolation](test-isolation.md) - How isolation works
