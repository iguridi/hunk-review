# Test Architecture

## Overview

The test suite consists of two main test files with completely isolated tests:

- [tests/basic.test.ts](../tests/basic.test.ts) - Unit tests (10 tests)
- [tests/e2e-tui.test.ts](../tests/e2e-tui.test.ts) - End-to-end tests (3 tests)

**Total: 13 tests, 35 expect() calls**

## Test File Structure

### Unit Tests ([basic.test.ts](../tests/basic.test.ts))

```typescript
describe.serial('ContentHasher', () => {
  // 2 tests - pure functions, no I/O
})

describe.serial('DiffParser', () => {
  // 2 tests - pure parsing, no I/O
})

describe.serial('ReviewStore', () => {
  // 4 tests - file I/O with isolated temp directories
})

describe.serial('DiffProcessor', () => {
  // 2 tests - file I/O with isolated temp directories
})
```

### E2E Tests ([e2e-tui.test.ts](../tests/e2e-tui.test.ts))

```typescript
describe.serial('E2E TUI Tests', () => {
  // 3 tests - spawn TUI subprocesses
})
```

## Key Design Decisions

### 1. No Shared State

❌ **Removed**: `beforeEach` and `afterEach` hooks
✅ **Instead**: Each test creates its own resources inline

**Rationale**: Bun's `beforeEach` hooks don't isolate properly with `--concurrent` flag.

### 2. Unique Temp Directories

Every test that needs file I/O creates a unique directory:

```typescript
const storageDir = join(tmpdir(), `test-review-${Date.now()}-${Math.random().toString(36).slice(2)}`);
```

**Pattern**: `{prefix}-${Date.now()}-${random}`

This ensures no test can interfere with another's files, even when running concurrently.

### 3. Serial Execution Within Describe Blocks

All `describe` blocks use `.serial()`:

```typescript
describe.serial('ReviewStore', () => { ... })
```

**Effect**: Tests within each describe block run sequentially, but different describe blocks can run concurrently.

## Test Categories

### Pure Logic Tests (No I/O)
- ContentHasher tests
- DiffParser tests

These are fast and have no side effects.

### File I/O Tests (Isolated)
- ReviewStore tests (4 tests)
- DiffProcessor tests (2 tests)

Each test:
1. Creates unique temp directory
2. Instantiates fresh store/processor
3. Performs operations
4. Verifies results
5. No cleanup needed (temp dirs are ephemeral)

### Process Spawn Tests (E2E)
- TUI tests (3 tests)

See [E2E Testing](e2e-testing.md) for details.

## Related Documentation

- [Test Isolation](test-isolation.md) - How isolation is achieved
- [E2E Testing](e2e-testing.md) - Subprocess testing details
- [Concurrency Limitations](concurrency-limitations.md) - Why full concurrency doesn't work
