#!/usr/bin/env node

import { CLIParser } from './cli/parser.ts';
import { InputReader } from './utils/input.ts';
import { DiffParser } from './diff/parser.ts';
import { DiffProcessor } from './diff/processor.ts';
import { ReviewStore } from './storage/ReviewStore.ts';
import { ContentHasher } from './hashing/hasher.ts';
import { TUIController } from './ui/tui.ts';

async function main() {
  try {
    // Parse CLI arguments
    const cliParser = new CLIParser();
    const options = cliParser.parse(process.argv);

    // Initialize components
    const reviewStore = new ReviewStore(options.storageDir);
    await reviewStore.load();

    // Handle special commands
    if (options.stats) {
      const stats = reviewStore.getStats();
      console.log('Review Statistics:');
      console.log(`  Total reviewed hunks: ${stats.totalReviewedHunks}`);
      console.log(`  Last updated: ${stats.lastUpdated || 'Never'}`);
      process.exit(0);
    }

    if (options.reset) {
      await reviewStore.reset();
      console.log('All reviews have been reset.');
      process.exit(0);
    }

    // Read diff input
    const inputReader = new InputReader();
    const diffText = await inputReader.read(options.file);

    // Parse diff
    const diffParser = new DiffParser();
    const files = diffParser.parse(diffText);

    // Process diff with review state
    const hasher = new ContentHasher({ normalizeWhitespace: false });
    const processor = new DiffProcessor(reviewStore, hasher);
    const processedDiff = await processor.process(files);

    // Check if there are any hunks to review
    if (processedDiff.totalHunks === 0) {
      console.log('No changes found in diff.');
      process.exit(0);
    }

    if (processedDiff.unreviewedHunks === 0) {
      console.log('All hunks have been reviewed!');
      console.log(`Total: ${processedDiff.totalHunks} hunks`);
      process.exit(0);
    }

    // Start TUI
    const tui = new TUIController(processedDiff, reviewStore, hasher);
    await tui.start();
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
