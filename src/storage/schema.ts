export interface ReviewMetadata {
  firstSeenAt: string;
  lastReviewedAt: string;
  reviewCount: number;
  context?: string; // Hunk header for debugging
}

export interface ReviewData {
  version: string;
  reviewedHunks: Record<string, ReviewMetadata>;
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
  statistics: {
    totalReviewedHunks: 0,
    lastUpdated: new Date().toISOString(),
  },
});
