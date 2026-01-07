import { createHash } from 'crypto';
import stripAnsi from 'strip-ansi';
import type { Chunk } from '../diff/types.ts';

export interface HashConfig {
  normalizeWhitespace: boolean;
}

export class ContentHasher {
  constructor(private config: HashConfig = { normalizeWhitespace: false }) {}

  /**
   * Generate a hash for an entire hunk based on its changed lines
   */
  hashHunk(chunk: Chunk): string {
    const normalized = this.normalizeHunkContent(chunk);
    return createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  /**
   * Normalize hunk content by concatenating all changed lines
   */
  private normalizeHunkContent(chunk: Chunk): string {
    const lines = chunk.changes
      .filter((change) => change.type === 'add' || change.type === 'del')
      .map((change) => this.normalizeLineContent(change.content))
      .join('\n');

    return lines;
  }

  /**
   * Normalize a single line's content
   */
  private normalizeLineContent(content: string): string {
    let normalized = content;

    // 1. Remove diff prefix (+, -, space)
    normalized = normalized.replace(/^[+\- ]/, '');

    // 2. Strip ANSI color codes
    normalized = stripAnsi(normalized);

    // 3. Optionally normalize whitespace
    if (this.config.normalizeWhitespace) {
      normalized = normalized.trim();
      normalized = normalized.replace(/\s+/g, ' ');
    }

    return normalized;
  }

  /**
   * Get a context string from a hunk for debugging
   */
  getHunkContext(chunk: Chunk): string {
    return chunk.content || `@@ -${chunk.oldStart},${chunk.oldLines} +${chunk.newStart},${chunk.newLines} @@`;
  }
}
