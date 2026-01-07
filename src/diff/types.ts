import type { File, Chunk, Change } from 'parse-diff';

export type { File, Chunk, Change };

export interface ProcessedHunk {
  chunk: Chunk;
  hash: string;
  reviewed: boolean;
  fileIndex: number;
}

export interface ProcessedFile {
  file: File;
  hunks: ProcessedHunk[];
  fileIndex: number;
}

export interface ProcessedDiff {
  files: ProcessedFile[];
  totalHunks: number;
  reviewedHunks: number;
  unreviewedHunks: number;
}
