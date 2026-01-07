import { describe, it, expect } from 'bun:test';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SAMPLE_DIFF = `diff --git a/test1.ts b/test1.ts
index 1234567..abcdefg 100644
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
index 2345678..bcdefgh 100644
--- a/test2.ts
+++ b/test2.ts
@@ -1,3 +1,4 @@
 const x = 10;
+const y = 20;
 const z = 30;
`;

const TIMEOUT = 3000;

async function createTestEnv() {
  const testDir = join(tmpdir(), `tui-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
  const diffFile = join(testDir, 'test.diff');
  const storageDir = join(testDir, 'storage');
  await writeFile(diffFile, SAMPLE_DIFF);
  await mkdir(storageDir, { recursive: true });
  return { testDir, diffFile, storageDir };
}

async function runTUICommand(
  diffFile: string,
  storageDir: string,
  keys: string[],
  timeout = TIMEOUT
): Promise<string> {
  return new Promise((resolve, reject) => {
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

    let output = '';
    let errorOutput = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    setTimeout(() => {
      let delay = 0;
      for (const key of keys) {
        setTimeout(() => {
          proc.stdin?.write(key);
        }, delay);
        delay += 20;
      }
    }, 50);

    const timer = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        setTimeout(() => {
          resolve(output + errorOutput);
        }, 700);
      } else {
        reject(new Error(`Process exited with code ${code}\nOutput: ${output}\nError: ${errorOutput}`));
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

describe.serial('E2E TUI Tests', () => {
  it('should launch, mark reviews, and persist without immediate exit', async () => {
    const { diffFile, storageDir } = await createTestEnv();
    const startTime = Date.now();
    await runTUICommand(diffFile, storageDir, [' ', ' ', 'q']);
    expect(Date.now() - startTime).toBeGreaterThan(50);

    const storagePath = join(storageDir, 'reviewed.json');
    expect(existsSync(storagePath)).toBe(true);
    const data = JSON.parse(await Bun.file(storagePath).text());
    expect(data.statistics.totalReviewedHunks).toBeGreaterThanOrEqual(1);
  });

  it('should filter reviewed hunks on second view (same session)', async () => {
    const { diffFile, storageDir } = await createTestEnv();
    const storagePath = join(storageDir, 'reviewed.json');

    // First run: mark first hunk
    await runTUICommand(diffFile, storageDir, [' ', 'q']);
    const data1 = JSON.parse(await Bun.file(storagePath).text());
    const sessionId = Object.keys(data1.sessions)[0]!;
    expect(data1.sessions[sessionId]?.reviewedHashes.length).toBe(1);

    // Second run: should skip first hunk, mark second hunk
    await runTUICommand(diffFile, storageDir, [' ', 'q']);
    const data2 = JSON.parse(await Bun.file(storagePath).text());
    expect(data2.sessions[sessionId]?.reviewedHashes.length).toBe(2);
  });

  it('should show completion message when all hunks reviewed', async () => {
    const { diffFile, storageDir } = await createTestEnv();
    const output = await runTUICommand(diffFile, storageDir, [' ', ' ', ' ', 'q']);
    expect(output).toContain('All hunks reviewed.');
  });
});
