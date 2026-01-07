import { Command } from 'commander';

export interface CLIOptions {
  file?: string;
  storageDir?: string;
  reset?: boolean;
  resetSession?: boolean;
  stats?: boolean;
}

export class CLIParser {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('reviewed-patch')
      .description('Interactive diff patch review tool with persistent tracking')
      .version('0.1.0');

    this.program
      .option('-f, --file <path>', 'Read diff from file instead of stdin')
      .option('-s, --storage-dir <path>', 'Override storage directory')
      .option('--reset', 'Clear all reviewed hunks (all sessions)')
      .option('--reset-session', 'Clear reviewed hunks for current session only')
      .option('--stats', 'Show review statistics');
  }

  parse(args: string[]): CLIOptions {
    this.program.parse(args);
    const options = this.program.opts();

    return {
      file: options.file,
      storageDir: options.storageDir,
      reset: options.reset,
      resetSession: options.resetSession,
      stats: options.stats,
    };
  }
}
