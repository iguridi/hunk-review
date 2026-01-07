export interface ReviewMetadata {
  firstSeenAt: string;
  lastReviewedAt: string;
  reviewCount: number;
  context?: string; // Hunk header for debugging
  sessions: string[]; // List of session IDs where this was reviewed
}

export interface SessionData {
  sessionId: string;
  repoName: string;
  branchName: string;
  reviewedHashes: string[]; // Hunks reviewed in this session
  lastUpdated: string;
}

export interface ReviewData {
  version: string;
  reviewedHunks: Record<string, ReviewMetadata>;
  sessions: Record<string, SessionData>; // Track per-session state
  statistics: {
    totalReviewedHunks: number;
    lastUpdated: string;
  };
}

export interface ReviewStats {
  totalReviewedHunks: number;
  lastUpdated: string | null;
}

export const createEmptyReviewData = (): ReviewData => ({
  version: '1.0.0',
  reviewedHunks: {},
  sessions: {},
  statistics: {
    totalReviewedHunks: 0,
    lastUpdated: new Date().toISOString(),
  },
});
