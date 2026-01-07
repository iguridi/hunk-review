# File Operations

## Overview

File operations in tests require careful handling due to:
1. Asynchronous file system operations
2. Process cleanup timing
3. OS buffer flushing

## File Write Flow

### In Application Code

**Code** - [src/storage/ReviewStore.ts:70-82](../src/storage/ReviewStore.ts#L70-L82):
```typescript
async save(): Promise<void> {
  try {
    await this.ensureDirectoryExists();
    this.data.statistics.lastUpdated = new Date().toISOString();
    const content = JSON.stringify(this.data, null, 2);
    await writeFile(this.storageFile, content, 'utf-8');
  } catch (error) {
    console.error('Failed to save review data:', error);
    throw error;
  }
}
```

**Steps**:
1. Ensure directory exists
2. Update timestamp
3. Serialize data to JSON
4. Write to file (awaited)

**Note**: The `await writeFile()` ensures the Node.js call completes, but doesn't guarantee OS buffer flush.

### In Tests

Tests need to verify files exist and contain correct data.

## Polling Strategy

### waitForFile() Implementation

**Code** - [tests/e2e-tui.test.ts:8-19](../tests/e2e-tui.test.ts#L8-L19):
```typescript
async function waitForFile(filePath: string, maxWait = 100): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    if (existsSync(filePath)) {
      // File exists, wait a bit more for write to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}
```

**Parameters**:
- `maxWait`: Maximum time to poll (default 100ms)
- Poll interval: 50ms
- Extra delay after detection: 100ms

**Total max time**: 100ms polling + 100ms = 200ms

### Why Polling Instead of Fixed Delay

**Fixed Delay**:
```typescript
// Wait 500ms for file
await new Promise(resolve => setTimeout(resolve, 500));
if (existsSync(filePath)) { ... }
```

**Problems**:
- ❌ Wastes time if file is ready earlier
- ❌ May not be enough if system is slow
- ❌ No feedback on why it failed

**Polling**:
```typescript
// Poll up to 100ms
const exists = await waitForFile(filePath);
if (exists) { ... }
```

**Benefits**:
- ✅ Returns as soon as file exists
- ✅ Clear boolean result
- ✅ Configurable timeout
- ✅ Extra delay for write completion

## Usage in Tests

### Unit Tests (Direct File Access)

**Code** - [tests/basic.test.ts:102-105](../tests/basic.test.ts#L102-L105):
```typescript
await store.markHunkReviewed(hash, 'test context');
expect(store.hasReviewedHunk(hash)).toBe(true);

// In-memory check, no file polling needed
```

Unit tests check in-memory state immediately after async operations complete.

### E2E Tests (Subprocess File Writes)

**Code** - [tests/e2e-tui.test.ts:110-118](../tests/e2e-tui.test.ts#L110-L118):
```typescript
await runTUICommand(diffFile, storageDir, [' ', ' ', 'q']);
expect(Date.now() - startTime).toBeGreaterThan(50);

const storagePath = join(storageDir, 'reviewed.json');
const fileExists = await waitForFile(storagePath);
expect(fileExists).toBe(true);
const data = JSON.parse(await Bun.file(storagePath).text());
expect(data.statistics.totalReviewedHunks).toBeGreaterThanOrEqual(1);
```

**Flow**:
1. Run TUI command (spawns process)
2. Wait for process to complete (with 100ms post-close delay)
3. Poll for file existence (up to 100ms)
4. Extra 100ms delay for write completion
5. Read and parse file

## Timing Breakdown

### E2E Test Timing

```
TUI Process Spawns
    ↓
[50ms initial delay]
    ↓
Send keystrokes (20ms between each)
    ↓
Process handles input
    ↓
Process marks hunks and writes to file
    ↓
Process exits (close event)
    ↓
[100ms post-close delay] ← Ensures process cleanup
    ↓
Test resumes
    ↓
waitForFile() starts polling
    ↓
[Up to 100ms polling at 50ms intervals]
    ↓
File detected!
    ↓
[100ms extra delay] ← Ensures write completion
    ↓
Test reads file
```

**Total possible delay**: 50 + (N×20) + 100 + 100 + 100 = 350ms + keystroke time

### Timeout Protection

**Code** - [tests/e2e-tui.test.ts:31](../tests/e2e-tui.test.ts#L31):
```typescript
const TIMEOUT = 1000; // 1 second
```

If process doesn't complete within 1 second, test fails with timeout error.

## File System Considerations

### Temp Directory Strategy

**Pattern**:
```typescript
const dir = join(tmpdir(), `prefix-${Date.now()}-${Math.random().toString(36).slice(2)}`);
await mkdir(dir, { recursive: true });
```

**Why `recursive: true`**:
- Creates parent directories if needed
- No error if directory already exists
- Safe for concurrent calls

### No Explicit Cleanup

Tests don't delete temp directories because:
1. OS periodically cleans `/tmp` or equivalent
2. Cleanup adds complexity
3. Leaving files aids debugging
4. Unique directories prevent conflicts

### Directory Creation Timing

**Code** - [tests/basic.test.ts:97-98](../tests/basic.test.ts#L97-L98):
```typescript
const storageDir = join(tmpdir(), `test-review-${Date.now()}-${Math.random().toString(36).slice(2)}`);
await mkdir(storageDir, { recursive: true });
```

**Order matters**:
1. Generate unique path
2. Create directory
3. Instantiate objects using that path

## Common Issues

### Issue 1: File Doesn't Exist

**Symptoms**:
```
ENOENT: no such file or directory
```

**Causes**:
- Process didn't run
- Process crashed before writing
- File path mismatch
- Insufficient delays

**Debug**:
```typescript
console.log('Storage path:', storagePath);
console.log('File exists?', existsSync(storagePath));
console.log('Directory contents:', readdirSync(dirname(storagePath)));
```

### Issue 2: File Exists But Empty

**Symptoms**:
```
SyntaxError: Unexpected end of JSON input
```

**Causes**:
- File created but write not complete
- Process terminated mid-write
- Insufficient delay after detection

**Solution**: Increase extra delay in `waitForFile()`:
```typescript
await new Promise(resolve => setTimeout(resolve, 200)); // Increased from 100ms
```

### Issue 3: File Contains Partial Data

**Symptoms**:
- Missing properties
- Truncated JSON

**Causes**:
- Write buffer not flushed
- Process killed before complete

**Solution**: Ensure process exits cleanly before reading.

## Code Discrepancy Alert

⚠️ **DISCREPANCY FOUND**: The current `waitForFile()` default is 100ms:

```typescript
async function waitForFile(filePath: string, maxWait = 100): Promise<boolean> {
```

However, earlier documentation and code iterations used much longer timeouts (e.g., 3000ms) to handle concurrent load. The current 100ms may be too short when tests run under load.

**Recommendation**: Consider adjusting based on actual test performance:
```typescript
async function waitForFile(filePath: string, maxWait = 500): Promise<boolean> {
```

This would provide more margin for file system operations under concurrent load.

## Related Documentation

- [E2E Testing](e2e-testing.md) - Process spawning and timing
- [Test Isolation](test-isolation.md) - Unique directory strategy
- [Concurrency Limitations](concurrency-limitations.md) - Why timing matters under load
