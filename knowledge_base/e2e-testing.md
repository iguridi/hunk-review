# E2E Testing

## Overview

End-to-end tests spawn actual TUI processes and simulate user input to verify the complete application flow.

**File**: [tests/e2e-tui.test.ts](../tests/e2e-tui.test.ts)

## Architecture

### Test Environment Creation

Each test creates an isolated environment with:
- Unique temp directory
- Sample diff file
- Storage directory for reviewed.json

**Code** - [tests/e2e-tui.test.ts:33-40](../tests/e2e-tui.test.ts#L33-L40):
```typescript
async function createTestEnv() {
  const testDir = join(tmpdir(), `tui-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
  const diffFile = join(testDir, 'test.diff');
  const storageDir = join(testDir, 'storage');
  await writeFile(diffFile, SAMPLE_DIFF);
  await mkdir(storageDir, { recursive: true });
  return { testDir, diffFile, storageDir };
}
```

### Process Spawning

Tests spawn the TUI as a child process using Node's `spawn`:

**Code** - [tests/e2e-tui.test.ts:50-61](../tests/e2e-tui.test.ts#L50-L61):
```typescript
const proc = spawn('bun', [
  'run',
  'src/index.ts',
  '--file',
  diffFile,
  '--storage-dir',
  storageDir,
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: join(import.meta.dir, '..'),
  env: { ...process.env, NODE_ENV: 'test' },
});
```

**Key Parameters**:
- `stdio: ['pipe', 'pipe', 'pipe']` - Capture stdin/stdout/stderr
- `NODE_ENV: 'test'` - Triggers test-specific behavior in TUI
- `--file` and `--storage-dir` - Isolated test environment

### Simulated User Input

Keystrokes are sent to the process stdin:

**Code** - [tests/e2e-tui.test.ts:74-82](../tests/e2e-tui.test.ts#L74-L82):
```typescript
setTimeout(() => {
  let delay = 0;
  for (const key of keys) {
    setTimeout(() => {
      proc.stdin?.write(key);
    }, delay);
    delay += 20; // 20ms between keystrokes
  }
}, 50); // Wait 50ms before starting
```

**Timing**:
- 50ms initial delay (process startup)
- 20ms between keystrokes (realistic typing speed)

### Process Completion

**Code** - [tests/e2e-tui.test.ts:101-111](../tests/e2e-tui.test.ts#L101-L111):
```typescript
proc.on('close', (code) => {
  clearTimeout(timer);
  if (code === 0) {
    // Delay to ensure file writes complete
    setTimeout(() => {
      resolve(output + errorOutput);
    }, 100);
  } else {
    reject(new Error(`Process exited with code ${code}...`));
  }
});
```

**Post-Close Delay**: 100ms to ensure file system writes complete.

### Timeout Handling

**Code** - [tests/e2e-tui.test.ts:31](../tests/e2e-tui.test.ts#L31):
```typescript
const TIMEOUT = 1000; // 1 second max per test
```

Each test has 1 second to complete, including:
- Process spawn
- TUI initialization
- User input simulation
- File writes
- Process cleanup

## File Polling

Instead of fixed delays, tests poll for file existence:

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

**Poll Interval**: 50ms
**Max Wait**: 100ms
**Extra Delay**: 100ms after file detected (for write completion)

**Note**: The current `maxWait = 100` in code appears to be reduced from earlier iterations. Original documentation suggested 3000ms. This may need adjustment.

## Test Cases

### 1. Launch and Persist Test

**Code** - [tests/e2e-tui.test.ts:108-119](../tests/e2e-tui.test.ts#L108-L119):
```typescript
it('should launch, mark reviews, and persist without immediate exit', async () => {
  const { diffFile, storageDir } = await createTestEnv();
  const startTime = Date.now();
  await runTUICommand(diffFile, storageDir, [' ', ' ', 'q']);
  expect(Date.now() - startTime).toBeGreaterThan(50);

  const storagePath = join(storageDir, 'reviewed.json');
  const fileExists = await waitForFile(storagePath);
  expect(fileExists).toBe(true);
  const data = JSON.parse(await Bun.file(storagePath).text());
  expect(data.statistics.totalReviewedHunks).toBeGreaterThanOrEqual(1);
});
```

**Actions**: Space, Space, Q
**Verifies**:
- Process stays open > 50ms
- Storage file created
- At least 1 hunk marked as reviewed

### 2. Session Filtering Test

**Code** - [tests/e2e-tui.test.ts:121-137](../tests/e2e-tui.test.ts#L121-L137):
```typescript
it('should filter reviewed hunks on second view (same session)', async () => {
  const { diffFile, storageDir } = await createTestEnv();
  const storagePath = join(storageDir, 'reviewed.json');

  // First run: mark first hunk
  await runTUICommand(diffFile, storageDir, [' ', 'q']);
  await waitForFile(storagePath);
  const data1 = JSON.parse(await Bun.file(storagePath).text());
  const sessionId = Object.keys(data1.sessions)[0]!;
  expect(data1.sessions[sessionId]?.reviewedHashes.length).toBe(1);

  // Second run: should skip first hunk, mark second hunk
  await runTUICommand(diffFile, storageDir, [' ', 'q']);
  await waitForFile(storagePath);
  const data2 = JSON.parse(await Bun.file(storagePath).text());
  expect(data2.sessions[sessionId]?.reviewedHashes.length).toBe(2);
});
```

**Critical Test**: Verifies that reviewed hunks are filtered out on subsequent runs.

**Actions**:
1. First run: Mark 1 hunk
2. Second run: Should skip first, mark second

**Verifies**:
- Session persistence across runs
- Hunk filtering works
- Review count increments correctly

### 3. Completion Message Test

**Code** - [tests/e2e-tui.test.ts:139-143](../tests/e2e-tui.test.ts#L139-L143):
```typescript
it('should show completion message when all hunks reviewed', async () => {
  const { diffFile, storageDir } = await createTestEnv();
  const output = await runTUICommand(diffFile, storageDir, [' ', ' ', ' ', 'q']);
  expect(output).toContain('All hunks reviewed.');
});
```

**Actions**: Space, Space, Space, Q (marks all 3 hunks)
**Verifies**: Completion message appears in output

## Test-Specific Behavior

The TUI has test-specific code:

**Code** - [src/ui/tui.ts:314-324](../src/ui/tui.ts#L314-L324):
```typescript
private async showCompletionAndQuit(): Promise<void> {
  this.screen.destroy();
  const message = 'All hunks reviewed.';
  if (process.env.NODE_ENV === 'test') {
    console.error('E2E_TEST_REVIEW_COMPLETE');
    console.error(message);
  } else {
    console.log(message);
  }
  await this.quit();
}
```

In test mode, messages go to stderr for easier capture.

## Challenges

### Terminal UI Testing

The TUI uses `blessed`, a terminal UI library that:
- Expects a real TTY
- Outputs ANSI escape codes
- Requires stdin for input

**Solutions**:
- Pipe stdin/stdout/stderr
- Simulate keystrokes programmatically
- Parse ANSI-coded output

### Timing Sensitivity

File writes are asynchronous and may not complete immediately after process exit.

**Solution**: Combination of:
1. Post-close delay (100ms)
2. File polling with `waitForFile()`
3. Additional delay after file detected (100ms)

### Concurrency Issues

See [Concurrency Limitations](concurrency-limitations.md) for why E2E tests can't run fully concurrently.

## Related Documentation

- [Test Architecture](test-architecture.md) - Overall structure
- [Concurrency Limitations](concurrency-limitations.md) - Why concurrent E2E fails
- [File Operations](file-operations.md) - File polling details
