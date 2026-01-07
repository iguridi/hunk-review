import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { ReviewData, ReviewStats, SessionData } from './schema.ts';
import { createEmptyReviewData } from './schema.ts';

export class ReviewStore {
  private data: ReviewData;
  private storageFile: string;
  private currentSessionId: string | null = null;

  constructor(storageDir?: string, sessionId?: string | null) {
    const baseDir = storageDir || join(homedir(), '.reviewed-patch');
    this.storageFile = join(baseDir, 'reviewed.json');
    this.data = createEmptyReviewData();
    this.currentSessionId = sessionId || null;
  }

  setSession(sessionId: string, repoName: string, branchName: string): void {
    this.currentSessionId = sessionId;

    // Initialize session if it doesn't exist
    if (!this.data.sessions[sessionId]) {
      this.data.sessions[sessionId] = {
        sessionId,
        repoName,
        branchName,
        reviewedHashes: [],
        lastUpdated: new Date().toISOString(),
      };
    }
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

      // Ensure sessions object exists (for backwards compatibility)
      if (!this.data.sessions) {
        this.data.sessions = {};
      }
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
   * Check if a hunk has been reviewed (globally or in current session)
   */
  hasReviewedHunk(hash: string): boolean {
    // If we have a session, only check if reviewed in current session
    if (this.currentSessionId) {
      return this.hasReviewedInSession(hash, this.currentSessionId);
    }

    // Otherwise check global review status
    return hash in this.data.reviewedHunks;
  }

  /**
   * Check if reviewed in a specific session
   */
  hasReviewedInSession(hash: string, sessionId: string): boolean {
    const session = this.data.sessions[sessionId];
    return session ? session.reviewedHashes.includes(hash) : false;
  }

  /**
   * Mark a hunk as reviewed
   */
  async markHunkReviewed(hash: string, context?: string): Promise<void> {
    const now = new Date().toISOString();

    // Update global review data
    if (this.data.reviewedHunks[hash]) {
      // Update existing entry
      this.data.reviewedHunks[hash]!.lastReviewedAt = now;
      this.data.reviewedHunks[hash]!.reviewCount++;

      // Add session if not already there
      if (this.currentSessionId && !this.data.reviewedHunks[hash]!.sessions.includes(this.currentSessionId)) {
        this.data.reviewedHunks[hash]!.sessions.push(this.currentSessionId);
      }
    } else {
      // Create new entry
      this.data.reviewedHunks[hash] = {
        firstSeenAt: now,
        lastReviewedAt: now,
        reviewCount: 1,
        context,
        sessions: this.currentSessionId ? [this.currentSessionId] : [],
      };
      this.data.statistics.totalReviewedHunks++;
    }

    // Update session-specific data
    if (this.currentSessionId) {
      const session = this.data.sessions[this.currentSessionId];
      if (session && !session.reviewedHashes.includes(hash)) {
        session.reviewedHashes.push(hash);
        session.lastUpdated = now;
      }
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
