import parseDiff from 'parse-diff';
import type { File } from './types.ts';

export class DiffParser {
  /**
   * Parse diff text into structured format
   */
  parse(diffText: string): File[] {
    if (!diffText || diffText.trim().length === 0) {
      throw new Error('Empty diff provided');
    }

    try {
      const files = parseDiff(diffText);

      if (!files || files.length === 0) {
        throw new Error('No files found in diff');
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to parse diff: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Count total hunks across all files
   */
  countHunks(files: File[]): number {
    return files.reduce((total, file) => total + (file.chunks?.length || 0), 0);
  }
}
