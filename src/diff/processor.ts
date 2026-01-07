import type { ReviewStore } from '../storage/ReviewStore.ts';
import type { ContentHasher } from '../hashing/hasher.ts';
import type { File, ProcessedDiff, ProcessedFile, ProcessedHunk } from './types.ts';

export class DiffProcessor {
  constructor(
    private reviewStore: ReviewStore,
    private hasher: ContentHasher
  ) {}

  /**
   * Process parsed diff files and enrich with review state
   */
  async process(files: File[]): Promise<ProcessedDiff> {
    const processedFiles: ProcessedFile[] = [];
    let totalHunks = 0;
    let reviewedHunks = 0;

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex]!;
      const hunks: ProcessedHunk[] = [];

      if (file.chunks) {
        for (const chunk of file.chunks) {
          const hash = this.hasher.hashHunk(chunk);
          const reviewed = this.reviewStore.hasReviewedHunk(hash);

          hunks.push({
            chunk,
            hash,
            reviewed,
            fileIndex,
          });

          totalHunks++;
          if (reviewed) {
            reviewedHunks++;
          }
        }
      }

      processedFiles.push({
        file,
        hunks,
        fileIndex,
      });
    }

    return {
      files: processedFiles,
      totalHunks,
      reviewedHunks,
      unreviewedHunks: totalHunks - reviewedHunks,
    };
  }

  /**
   * Filter to only unreviewed hunks
   */
  filterUnreviewed(diff: ProcessedDiff): ProcessedDiff {
    const filteredFiles: ProcessedFile[] = [];

    for (const processedFile of diff.files) {
      const unreviewedHunks = processedFile.hunks.filter((h) => !h.reviewed);

      if (unreviewedHunks.length > 0) {
        filteredFiles.push({
          ...processedFile,
          hunks: unreviewedHunks,
        });
      }
    }

    return {
      ...diff,
      files: filteredFiles,
    };
  }
}
