import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { ReviewData, ReviewStats } from './schema.ts';
import { createEmptyReviewData } from './schema.ts';

export class ReviewStore {
  private data: ReviewData;
  private storageFile: string;

  constructor(storageDir?: string) {
    const baseDir = storageDir || join(homedir(), '.reviewed-patch');
    this.storageFile = join(baseDir, 'reviewed.json');
    this.data = createEmptyReviewData();
  }

  /**
   * Load review data from disk
   */
  async load(): Promise<void> {
    try {
      if (!existsSync(this.storageFile)) {
        // File doesn't exist yet, use empty data
        await this.ensureDirectoryExists();
        return;
      }

      const content = await readFile(this.storageFile, 'utf-8');
      const parsed = JSON.parse(content);

      // Validate version
      if (parsed.version !== '1.0.0') {
        console.warn(`Unknown storage version: ${parsed.version}. Using empty data.`);
        return;
      }

      this.data = parsed;
    } catch (error) {
      console.error('Failed to load review data:', error);
      // Continue with empty data
    }
  }

  /**
   * Save review data to disk atomically
   */
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

  /**
   * Check if a hunk has been reviewed
   */
  hasReviewedHunk(hash: string): boolean {
    return hash in this.data.reviewedHunks;
  }

  /**
   * Mark a hunk as reviewed
   */
  async markHunkReviewed(hash: string, context?: string): Promise<void> {
    const now = new Date().toISOString();

    if (this.data.reviewedHunks[hash]) {
      // Update existing entry
      this.data.reviewedHunks[hash]!.lastReviewedAt = now;
      this.data.reviewedHunks[hash]!.reviewCount++;
    } else {
      // Create new entry
      this.data.reviewedHunks[hash] = {
        firstSeenAt: now,
        lastReviewedAt: now,
        reviewCount: 1,
        context,
      };
      this.data.statistics.totalReviewedHunks++;
    }

    await this.save();
  }

  /**
   * Unmark a hunk (remove from reviewed)
   */
  async unmarkHunk(hash: string): Promise<void> {
    if (this.data.reviewedHunks[hash]) {
      delete this.data.reviewedHunks[hash];
      this.data.statistics.totalReviewedHunks = Math.max(
        0,
        this.data.statistics.totalReviewedHunks - 1
      );
      await this.save();
    }
  }

  /**
   * Get review statistics
   */
  getStats(): ReviewStats {
    return {
      totalReviewedHunks: this.data.statistics.totalReviewedHunks,
      lastUpdated: this.data.statistics.lastUpdated || null,
    };
  }

  /**
   * Reset all reviews
   */
  async reset(): Promise<void> {
    this.data = createEmptyReviewData();
    await this.save();
  }

  /**
   * Ensure the storage directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    const dir = dirname(this.storageFile);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}
