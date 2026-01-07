import blessed from 'blessed';
import type { ReviewStore } from '../storage/ReviewStore.ts';
import type { ContentHasher } from '../hashing/hasher.ts';
import type { ProcessedDiff, ProcessedHunk } from '../diff/types.ts';

export class TUIController {
  private screen: blessed.Widgets.Screen;
  private diffView: blessed.Widgets.BoxElement;
  private statusBar: blessed.Widgets.BoxElement;
  private currentHunkIndex: number = 0;
  private allHunks: ProcessedHunk[] = [];

  constructor(
    private diff: ProcessedDiff,
    private reviewStore: ReviewStore,
    private hasher: ContentHasher
  ) {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Reviewed Patch',
    });

    // Flatten all hunks for navigation
    this.allHunks = this.flattenHunks();

    // Create UI components
    this.diffView = this.createDiffView();
    this.statusBar = this.createStatusBar();

    // Setup keyboard handlers
    this.setupKeyBindings();

    // Initial render
    this.render();
  }

  private createDiffView(): blessed.Widgets.BoxElement {
    return blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-1',
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      mouse: false,
      tags: true,
      scrollbar: {
        ch: '│',
        style: {
          fg: 'blue',
        },
      },
    });
  }

  private createStatusBar(): blessed.Widgets.BoxElement {
    return blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      style: {
        fg: 'white',
        bg: 'blue',
      },
    });
  }

  private flattenHunks(): ProcessedHunk[] {
    const hunks: ProcessedHunk[] = [];
    for (const file of this.diff.files) {
      hunks.push(...file.hunks);
    }
    return hunks;
  }

  private setupKeyBindings(): void {
    // Navigation
    this.screen.key(['down', 'j'], () => {
      this.navigateNext();
    });

    this.screen.key(['up', 'k'], () => {
      this.navigatePrevious();
    });

    // Mark/unmark
    this.screen.key(['space'], async () => {
      await this.markCurrentHunk();
    });

    this.screen.key(['u'], async () => {
      await this.unmarkCurrentHunk();
    });

    // Quit
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.quit();
    });

    // Help
    this.screen.key(['?'], () => {
      this.showHelp();
    });

    // Focus the diff view for scrolling
    this.diffView.focus();
  }

  private navigateNext(): void {
    if (this.currentHunkIndex < this.allHunks.length - 1) {
      this.currentHunkIndex++;
      this.render();
    }
  }

  private navigatePrevious(): void {
    if (this.currentHunkIndex > 0) {
      this.currentHunkIndex--;
      this.render();
    }
  }

  private async markCurrentHunk(): Promise<void> {
    const hunk = this.allHunks[this.currentHunkIndex];
    if (hunk && !hunk.reviewed) {
      const context = this.hasher.getHunkContext(hunk.chunk);
      await this.reviewStore.markHunkReviewed(hunk.hash, context);
      hunk.reviewed = true;

      // Update stats
      this.diff.reviewedHunks++;
      this.diff.unreviewedHunks--;

      this.render();

      // Auto-advance to next unreviewed hunk
      this.navigateToNextUnreviewed();
    }
  }

  private async unmarkCurrentHunk(): Promise<void> {
    const hunk = this.allHunks[this.currentHunkIndex];
    if (hunk && hunk.reviewed) {
      await this.reviewStore.unmarkHunk(hunk.hash);
      hunk.reviewed = false;

      // Update stats
      this.diff.reviewedHunks--;
      this.diff.unreviewedHunks++;

      this.render();
    }
  }

  private navigateToNextUnreviewed(): void {
    for (let i = this.currentHunkIndex + 1; i < this.allHunks.length; i++) {
      if (!this.allHunks[i]!.reviewed) {
        this.currentHunkIndex = i;
        this.render();
        return;
      }
    }
  }

  private render(): void {
    const content = this.buildContent();
    this.diffView.setContent(content);
    this.scrollToCurrentHunk();
    this.updateStatusBar();
    this.screen.render();
  }

  private scrollToCurrentHunk(): void {
    // Calculate line number of current hunk in the content
    let lineNumber = 0;
    let globalHunkIndex = 0;

    for (const file of this.diff.files) {
      lineNumber += 2; // File header + blank line

      for (const processedHunk of file.hunks) {
        if (globalHunkIndex === this.currentHunkIndex) {
          // Found current hunk, scroll to it
          // Use setImmediate to scroll after render completes
          setImmediate(() => {
            try {
              this.diffView.setScrollPerc(0); // Reset first
              this.diffView.setScroll(lineNumber);
              this.screen.render();
            } catch (error) {
              // Ignore scroll errors - can happen during initial render
            }
          });
          return;
        }

        // Count lines in this hunk
        lineNumber += 1; // Hunk header
        lineNumber += processedHunk.chunk.changes.length;
        lineNumber += 1; // Blank line after hunk

        globalHunkIndex++;
      }
    }
  }

  private buildContent(): string {
    const lines: string[] = [];
    let globalHunkIndex = 0;

    for (const file of this.diff.files) {
      // File header
      const fileName = file.file.to || file.file.from || 'unknown';
      lines.push(`{bold}{cyan-fg}File: ${fileName}{/cyan-fg}{/bold}`);
      lines.push('');

      for (const processedHunk of file.hunks) {
        const isCurrent = globalHunkIndex === this.currentHunkIndex;
        const prefix = isCurrent ? '{inverse}>{/inverse}' : ' ';
        const reviewStatus = processedHunk.reviewed
          ? '{green-fg}✓{/green-fg}'
          : '{yellow-fg} {/yellow-fg}';

        // Hunk header
        const hunkHeader = this.hasher.getHunkContext(processedHunk.chunk);
        lines.push(`${prefix}${reviewStatus} {cyan-fg}${hunkHeader}{/cyan-fg}`);

        // Hunk changes
        for (const change of processedHunk.chunk.changes) {
          let line = change.content || '';
          let colorPrefix = '';
          let colorSuffix = '';

          if (change.type === 'add') {
            colorPrefix = '{green-fg}';
            colorSuffix = '{/green-fg}';
          } else if (change.type === 'del') {
            colorPrefix = '{red-fg}';
            colorSuffix = '{/red-fg}';
          }

          lines.push(`${prefix}  ${colorPrefix}${line}${colorSuffix}`);
        }

        lines.push('');
        globalHunkIndex++;
      }
    }

    return lines.join('\n');
  }

  private updateStatusBar(): void {
    const current = this.currentHunkIndex + 1;
    const total = this.allHunks.length;
    const reviewed = this.diff.reviewedHunks;

    const status = `  Hunk ${current}/${total} | Reviewed: ${reviewed}/${total} | ↑/↓: Navigate  Space: Mark  U: Unmark  ?: Help  Q: Quit`;
    this.statusBar.setContent(status);
  }

  private showHelp(): void {
    const helpText = `
{bold}{center}Reviewed Patch - Help{/center}{/bold}

{bold}Navigation:{/bold}
  ↑, k         Previous hunk
  ↓, j         Next hunk

{bold}Actions:{/bold}
  Space        Mark current hunk as reviewed
  u            Unmark current hunk

{bold}Other:{/bold}
  ?            Show this help
  q, Esc       Quit

Press any key to close this help...
`;

    const helpBox = blessed.box({
      top: 'center',
      left: 'center',
      width: '60%',
      height: '60%',
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: 'cyan',
        },
      },
      tags: true,
      content: helpText,
    });

    this.screen.append(helpBox);
    helpBox.focus();

    helpBox.key(['escape', 'enter', 'space', 'q'], () => {
      this.screen.remove(helpBox);
      this.diffView.focus();
      this.screen.render();
    });

    this.screen.render();
  }

  private quit(): void {
    this.screen.destroy();
    process.exit(0);
  }

  async start(): Promise<void> {
    // Append components to screen
    this.screen.append(this.diffView);
    this.screen.append(this.statusBar);

    // Initial render
    this.render();

    // Keep the event loop alive - blessed needs this
    return new Promise(() => {
      // The promise never resolves - the app exits via quit()
      // This keeps Node.js running to handle keyboard events
    });
  }
}
