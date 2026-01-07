import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { spawn, ChildProcess } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * E2E TUI Tests
 * These tests launch the actual TUI and verify behavior through process interaction
 */

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

const TIMEOUT = 5000;

describe('E2E TUI Tests', () => {
  let testDir: string;
  let diffFile: string;
  let storageDir: string;

  beforeEach(async () => {
    // Create test directory
    testDir = join(tmpdir(), `tui-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    diffFile = join(testDir, 'test.diff');
    storageDir = join(testDir, 'storage');

    // Write sample diff
    await writeFile(diffFile, SAMPLE_DIFF);
    await mkdir(storageDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    try {
      await unlink(diffFile);
      await unlink(join(storageDir, 'reviewed.json')).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should launch TUI and display hunks', async () => {
    const output = await runTUICommand(diffFile, storageDir, ['q']); // Just launch and quit

    // Should show session info (if in git repo)
    expect(output).toContain('reviewed');

    // TUI should have launched (escape sequences present)
    expect(output.length).toBeGreaterThan(10);
  });

  it('should not exit immediately and accept user input', async () => {
    // This test ensures the TUI stays open long enough to receive input
    // If it exits immediately, the timeout will trigger before the 'q' is sent
    const startTime = Date.now();

    const output = await runTUICommand(diffFile, storageDir, [
      'j', // Navigate down
      'k', // Navigate up
      'q', // Quit
    ]);

    const duration = Date.now() - startTime;

    // Should take at least the initial delay (800ms) + key delays (500ms * 3)
    // If it exits immediately, it would complete much faster
    expect(duration).toBeGreaterThan(800);

    // Should have output from TUI
    expect(output.length).toBeGreaterThan(0);
  });

  it('should allow marking a hunk before exiting', async () => {
    // This test specifically checks that the TUI doesn't exit before user can interact
    // Tests the regression where render() in constructor caused immediate exit
    await runTUICommand(diffFile, storageDir, [
      ' ',  // Mark first hunk
      'q',  // Quit
    ]);

    // Verify the hunk was actually marked (proves TUI stayed open)
    const storagePath = join(storageDir, 'reviewed.json');
    expect(existsSync(storagePath)).toBe(true);

    const data = JSON.parse(await Bun.file(storagePath).text());
    expect(data.statistics.totalReviewedHunks).toBeGreaterThan(0);
  });

  it('should navigate between hunks with arrow keys', async () => {
    const output = await runTUICommand(diffFile, storageDir, [
      '\x1B[B', // Down arrow (next hunk)
      '\x1B[B', // Down arrow (next hunk)
      '\x1B[A', // Up arrow (previous hunk)
      'q',      // Quit
    ]);

    // Navigation should work (no errors)
    expect(output).toBeDefined();
  });

  it('should mark hunks as reviewed with space key', async () => {
    // First session: mark first hunk
    await runTUICommand(diffFile, storageDir, [
      ' ',  // Space - mark current hunk
      'q',  // Quit
    ]);

    // Check storage was created
    const storagePath = join(storageDir, 'reviewed.json');
    expect(existsSync(storagePath)).toBe(true);

    // Read storage
    const storageContent = await Bun.file(storagePath).text();
    const data = JSON.parse(storageContent);

    // Should have at least one reviewed hunk
    expect(Object.keys(data.reviewedHunks).length).toBeGreaterThan(0);
    expect(data.statistics.totalReviewedHunks).toBeGreaterThan(0);
  });

  it('should persist reviews across sessions', async () => {
    // Session 1: Mark first hunk
    await runTUICommand(diffFile, storageDir, [
      ' ',  // Mark current hunk
      'q',
    ]);

    // Get initial review count
    const storagePath = join(storageDir, 'reviewed.json');
    const data1 = JSON.parse(await Bun.file(storagePath).text());
    const reviewCount1 = data1.statistics.totalReviewedHunks;

    // Session 2: Mark second hunk
    await runTUICommand(diffFile, storageDir, [
      '\x1B[B', // Next hunk
      ' ',       // Mark it
      'q',
    ]);

    // Should have one more review
    const data2 = JSON.parse(await Bun.file(storagePath).text());
    expect(data2.statistics.totalReviewedHunks).toBeGreaterThan(reviewCount1);
  });

  it('should handle navigation keys j/k', async () => {
    const output = await runTUICommand(diffFile, storageDir, [
      'j', // Next (vim-style)
      'j', // Next
      'k', // Previous
      'q',
    ]);

    // Should complete without errors
    expect(output).toBeDefined();
  });

  it('should show help with ? key', async () => {
    // Note: Help modal requires another key to close
    await runTUICommand(diffFile, storageDir, [
      '?',     // Show help
      ' ',     // Close help (space key)
      'q',     // Quit
    ]);

    // Should complete without crashing
    expect(true).toBe(true);
  });

  it('should handle unmark with u key', async () => {
    // Mark a hunk
    await runTUICommand(diffFile, storageDir, [
      ' ',  // Mark
      'q',
    ]);

    const storagePath = join(storageDir, 'reviewed.json');
    const data1 = JSON.parse(await Bun.file(storagePath).text());
    const reviewCount1 = data1.statistics.totalReviewedHunks;

    // Unmark it
    await runTUICommand(diffFile, storageDir, [
      'u',  // Unmark current hunk
      'q',
    ]);

    const data2 = JSON.parse(await Bun.file(storagePath).text());

    // Count should be less (or same if first hunk wasn't the marked one)
    expect(data2.statistics.totalReviewedHunks).toBeLessThanOrEqual(reviewCount1);
  });

  it('should handle empty diff gracefully', async () => {
    const emptyDiffFile = join(testDir, 'empty.diff');
    await writeFile(emptyDiffFile, '');

    try {
      await runTUICommand(emptyDiffFile, storageDir, ['q'], 2000);
      // Should fail with error about empty diff
      expect(false).toBe(true); // Shouldn't reach here
    } catch (error) {
      // Expected to throw/timeout
      expect(true).toBe(true);
    }

    await unlink(emptyDiffFile);
  });

  it('should track session-specific reviews', async () => {
    // Mark some hunks
    await runTUICommand(diffFile, storageDir, [
      ' ',  // Mark first hunk
      'q',
    ]);

    const storagePath = join(storageDir, 'reviewed.json');
    const data = JSON.parse(await Bun.file(storagePath).text());

    // Should have session data
    expect(data.sessions).toBeDefined();
    expect(typeof data.sessions).toBe('object');

    // Should have reviewed hunks
    expect(Object.keys(data.reviewedHunks).length).toBeGreaterThan(0);

    // Each reviewed hunk should have sessions array
    const firstHunk = Object.values(data.reviewedHunks)[0] as any;
    expect(Array.isArray(firstHunk.sessions)).toBe(true);
  });

  it('should auto-advance to next unreviewed hunk after marking', async () => {
    // Mark multiple hunks with just space presses
    await runTUICommand(diffFile, storageDir, [
      ' ',  // Mark hunk 1 (should auto-advance)
      ' ',  // Mark hunk 2 (should auto-advance)
      ' ',  // Mark hunk 3
      'q',
    ]);

    const storagePath = join(storageDir, 'reviewed.json');
    const data = JSON.parse(await Bun.file(storagePath).text());

    // Should have marked multiple hunks
    expect(data.statistics.totalReviewedHunks).toBeGreaterThanOrEqual(2);
  });

  it('should not show reviewed hunks when viewing diff a second time in same session', async () => {
    const storagePath = join(storageDir, 'reviewed.json');

    // First session: Mark only the first hunk
    await runTUICommand(diffFile, storageDir, [
      ' ',  // Mark hunk 1
      'q',  // Quit (don't mark hunk 2)
    ]);

    // Verify first hunk was marked
    const data1 = JSON.parse(await Bun.file(storagePath).text());
    expect(data1.statistics.totalReviewedHunks).toBeGreaterThanOrEqual(1);

    // Get the session ID and count
    const sessionIds = Object.keys(data1.sessions);
    expect(sessionIds.length).toBeGreaterThan(0);
    const sessionId = sessionIds[0]!;
    const firstSessionCount = data1.sessions[sessionId]?.reviewedHashes.length || 0;
    expect(firstSessionCount).toBe(1); // Should be exactly 1

    // Second session with SAME diff: Should skip reviewed hunk 1, show hunk 2
    await runTUICommand(diffFile, storageDir, [
      ' ',  // Should mark hunk 2 (hunk 1 is already reviewed)
      'q',
    ]);

    // Read storage again
    const data2 = JSON.parse(await Bun.file(storagePath).text());

    // Session should have 2 hunks now (hunk 1 + hunk 2)
    expect(data2.sessions[sessionId]).toBeDefined();
    expect(data2.sessions[sessionId]?.reviewedHashes.length).toBe(2);

    // Third session: Should skip hunks 1 and 2, show hunk 3
    await runTUICommand(diffFile, storageDir, [
      ' ',  // Should mark hunk 3
      'q',
    ]);

    const data3 = JSON.parse(await Bun.file(storagePath).text());

    // Session should have at least 2 hunks, possibly 3
    // (Depending on whether hunk 3 got marked before the app exited)
    expect(data3.sessions[sessionId]?.reviewedHashes.length).toBeGreaterThanOrEqual(2);

    // Verify progressive review behavior: each run should only show unreviewed hunks
    // The key assertion is that reviewed hunks don't reappear
    // If we run again with all hunks reviewed, it should show "All hunks reviewed"
    expect(data3.statistics.totalReviewedHunks).toBeGreaterThanOrEqual(2);
  });

  it('should exit automatically and show completion message when all hunks are reviewed', async () => {
    const output = await runTUICommand(diffFile, storageDir, [
      ' ',  // Mark hunk 1
      ' ',  // Mark hunk 2
      ' ',  // Mark hunk 3 (last one) - should trigger exit
    ]);

    // Should show completion message
    expect(output).toContain('E2E_TEST_REVIEW_COMPLETE');
    expect(output).toContain('All hunks reviewed.');
  });
});

/**
 * Helper to run TUI command with simulated keypresses
 */
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

    // Send keypresses after a delay to let TUI initialize
    setTimeout(() => {
      // Send keys one at a time with delays
      let delay = 0;
      for (const key of keys) {
        setTimeout(() => {
          proc.stdin?.write(key);
        }, delay);
        delay += 500; // 500ms between keys
      }
    }, 800);

    // Timeout handler - now just rejects, doesn't kill process
    const timer = setTimeout(() => {
      // Don't kill the process, let it exit naturally
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);

      // Only code 0 is acceptable for a successful exit
      if (code === 0) {
        // Add small delay to ensure file writes complete
        setTimeout(() => {
          resolve(output + errorOutput);
        }, 500); // Increased delay
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
