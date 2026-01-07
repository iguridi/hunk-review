# Test Isolation

## Goal

Each test must be completely isolated so it can run independently without affecting or being affected by other tests.

## Implementation

### 1. Removed beforeEach/afterEach Hooks

**Before** (Shared State):
```typescript
describe('ReviewStore', () => {
  let storageDir: string;
  let store: ReviewStore;

  beforeEach(async () => {
    storageDir = join(tmpdir(), `test-review-${Date.now()}`);
    store = new ReviewStore(storageDir);
  });

  it('should save', async () => {
    // Uses shared `store`
  });
});
```

**Problem**: When tests run concurrently, `beforeEach` may execute multiple times with same timestamp, causing directory collisions.

**After** (Isolated):
```typescript
describe.serial('ReviewStore', () => {
  it('should save and load reviews', async () => {
    const storageDir = join(tmpdir(), `test-review-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(storageDir, { recursive: true });
    const store = new ReviewStore(storageDir);
    await store.load();

    // Test logic...
  });
});
```

**Solution**: Each test creates its own unique directory and instances.

### 2. Unique Directory Generation

**Pattern**:
```typescript
`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
```

**Components**:
- `Date.now()`: Millisecond timestamp
- `Math.random().toString(36).slice(2)`: Random alphanumeric string

**Examples**:
- `test-review-1767806986507-la05gvxvxko`
- `test-processor-1767806986508-3x8dnf9m2p`
- `tui-test-1767806986509-fw969f9yhvm`

**Collision Probability**: Effectively zero for test suite size

### 3. Explicit Resource Creation

Each test explicitly:
1. Creates its temp directory with `mkdir()`
2. Instantiates objects (store, processor, etc.)
3. Loads initial state
4. Runs test logic
5. No explicit cleanup (OS cleans temp directories)

**Example** - [tests/basic.test.ts:96-112](../tests/basic.test.ts#L96-L112):
```typescript
it('should save and load reviews', async () => {
  const storageDir = join(tmpdir(), `test-review-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(storageDir, { recursive: true });
  const store = new ReviewStore(storageDir);
  await store.load();

  const hash = 'test-hash-123';
  await store.markHunkReviewed(hash, 'test context');

  expect(store.hasReviewedHunk(hash)).toBe(true);

  // Create new store instance and load
  const store2 = new ReviewStore(storageDir);
  await store2.load();

  expect(store2.hasReviewedHunk(hash)).toBe(true);
});
```

## Verification

### Test Independence

Each test can be run in any order or in parallel (with caveats for E2E tests).

```bash
# Run specific test
bun test -t "should save and load reviews"

# Run all tests
bun test

# Run with concurrency (unit tests work, E2E has limitations)
bun test --concurrent
```

### No Side Effects

Tests do not:
- Share variables
- Write to common locations
- Depend on execution order
- Require cleanup

## Isolation Levels

| Test Type | Isolation Level | Concurrent Safe |
|-----------|----------------|-----------------|
| ContentHasher | Pure functions | ✅ Yes |
| DiffParser | Pure functions | ✅ Yes |
| ReviewStore | Unique temp dirs | ✅ Yes |
| DiffProcessor | Unique temp dirs | ✅ Yes |
| E2E TUI Tests | Unique temp dirs + subprocesses | ⚠️ Limited (see [Concurrency Limitations](concurrency-limitations.md)) |

## Related Documentation

- [Test Architecture](test-architecture.md) - Overall structure
- [E2E Testing](e2e-testing.md) - Process spawning isolation
- [File Operations](file-operations.md) - How file I/O is isolated
