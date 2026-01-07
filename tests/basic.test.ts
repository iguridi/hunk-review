import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ContentHasher } from '../src/hashing/hasher.ts';
import { DiffParser } from '../src/diff/parser.ts';
import { ReviewStore } from '../src/storage/ReviewStore.ts';
import { DiffProcessor } from '../src/diff/processor.ts';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ContentHasher', () => {
  it('should hash hunks consistently', () => {
    const hasher = new ContentHasher({ normalizeWhitespace: false });

    const mockChunk = {
      content: '@@ -10,6 +10,8 @@',
      changes: [
        { type: 'normal' as const, content: '  const foo = bar;' },
        { type: 'add' as const, content: '+  console.log("test");' },
        { type: 'add' as const, content: '+  const baz = qux;' },
      ],
      oldStart: 10,
      oldLines: 6,
      newStart: 10,
      newLines: 8,
    };

    const hash1 = hasher.hashHunk(mockChunk);
    const hash2 = hasher.hashHunk(mockChunk);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex digest
  });

  it('should only include add/del lines in hash', () => {
    const hasher = new ContentHasher({ normalizeWhitespace: false });

    const chunk1 = {
      content: '@@ -10,6 +10,8 @@',
      changes: [
        { type: 'normal' as const, content: '  context line' },
        { type: 'add' as const, content: '+  new line' },
      ],
      oldStart: 10,
      oldLines: 6,
      newStart: 10,
      newLines: 8,
    };

    const chunk2 = {
      content: '@@ -20,6 +20,8 @@',
      changes: [
        { type: 'normal' as const, content: '  different context' },
        { type: 'add' as const, content: '+  new line' },
      ],
      oldStart: 20,
      oldLines: 6,
      newStart: 20,
      newLines: 8,
    };

    // Same changes, different context - should have same hash
    const hash1 = hasher.hashHunk(chunk1);
    const hash2 = hasher.hashHunk(chunk2);

    expect(hash1).toBe(hash2);
  });
});

describe('DiffParser', () => {
  it('should parse a simple unified diff', () => {
    const parser = new DiffParser();
    const diff = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;
`;

    const files = parser.parse(diff);

    expect(files).toHaveLength(1);
    expect(files[0]?.chunks).toHaveLength(1);
  });

  it('should throw on empty diff', () => {
    const parser = new DiffParser();

    expect(() => parser.parse('')).toThrow('Empty diff');
  });
});

describe('ReviewStore', () => {
  let storageDir: string;
  let store: ReviewStore;

  beforeEach(() => {
    storageDir = join(tmpdir(), `test-review-${Date.now()}`);
    store = new ReviewStore(storageDir);
  });

  afterEach(async () => {
    try {
      await unlink(join(storageDir, 'reviewed.json'));
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it('should save and load reviews', async () => {
    await store.load();

    const hash = 'test-hash-123';
    await store.markHunkReviewed(hash, 'test context');

    expect(store.hasReviewedHunk(hash)).toBe(true);

    // Create new store instance and load
    const store2 = new ReviewStore(storageDir);
    await store2.load();

    expect(store2.hasReviewedHunk(hash)).toBe(true);
  });

  it('should unmark hunks', async () => {
    await store.load();

    const hash = 'test-hash-456';
    await store.markHunkReviewed(hash);

    expect(store.hasReviewedHunk(hash)).toBe(true);

    await store.unmarkHunk(hash);

    expect(store.hasReviewedHunk(hash)).toBe(false);
  });

  it('should track statistics', async () => {
    await store.load();

    await store.markHunkReviewed('hash1');
    await store.markHunkReviewed('hash2');

    const stats = store.getStats();

    expect(stats.totalReviewedHunks).toBe(2);
    expect(stats.lastUpdated).not.toBeNull();
  });
});

describe('DiffProcessor', () => {
  let storageDir: string;
  let store: ReviewStore;
  let hasher: ContentHasher;
  let processor: DiffProcessor;

  beforeEach(async () => {
    storageDir = join(tmpdir(), `test-processor-${Date.now()}`);
    store = new ReviewStore(storageDir);
    await store.load();
    hasher = new ContentHasher({ normalizeWhitespace: false });
    processor = new DiffProcessor(store, hasher);
  });

  afterEach(async () => {
    try {
      await unlink(join(storageDir, 'reviewed.json'));
    } catch {
      // Ignore
    }
  });

  it('should process diff and mark review state', async () => {
    const mockFiles = [
      {
        chunks: [
          {
            content: '@@ -1,3 +1,4 @@',
            changes: [
              { type: 'add' as const, content: '+new line' },
            ],
            oldStart: 1,
            oldLines: 3,
            newStart: 1,
            newLines: 4,
          },
        ],
        from: 'file.ts',
        to: 'file.ts',
      },
    ];

    const processed = await processor.process(mockFiles);

    expect(processed.totalHunks).toBe(1);
    expect(processed.reviewedHunks).toBe(0);
    expect(processed.unreviewedHunks).toBe(1);

    // Mark first hunk as reviewed
    const hash = processed.files[0]!.hunks[0]!.hash;
    await store.markHunkReviewed(hash);

    // Process again
    const processed2 = await processor.process(mockFiles);

    expect(processed2.reviewedHunks).toBe(1);
    expect(processed2.unreviewedHunks).toBe(0);
  });

  it('should filter unreviewed hunks', async () => {
    const mockFiles = [
      {
        chunks: [
          {
            content: '@@ -1,3 +1,4 @@',
            changes: [{ type: 'add' as const, content: '+line1' }],
            oldStart: 1,
            oldLines: 3,
            newStart: 1,
            newLines: 4,
          },
          {
            content: '@@ -10,3 +11,4 @@',
            changes: [{ type: 'add' as const, content: '+line2' }],
            oldStart: 10,
            oldLines: 3,
            newStart: 11,
            newLines: 4,
          },
        ],
        from: 'file.ts',
        to: 'file.ts',
      },
    ];

    const processed = await processor.process(mockFiles);

    // Mark first hunk as reviewed
    const hash = processed.files[0]!.hunks[0]!.hash;
    await store.markHunkReviewed(hash);

    const processed2 = await processor.process(mockFiles);
    const filtered = processor.filterUnreviewed(processed2);

    expect(filtered.files).toHaveLength(1);
    expect(filtered.files[0]!.hunks).toHaveLength(1);
    expect(filtered.files[0]!.hunks[0]!.reviewed).toBe(false);
  });
});
