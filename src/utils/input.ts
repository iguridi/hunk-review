import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export class InputReader {
  /**
   * Read diff from stdin
   */
  async readStdin(): Promise<string> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      process.stdin.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });
      process.stdin.on('error', (error) => reject(error));
    });
  }

  /**
   * Reopen stdin from /dev/tty for interactive blessed input
   */
  async reopenStdin(): Promise<void> {
    // Only reopen if we consumed stdin for reading the diff
    if (process.stdin.isTTY) {
      return; // Already have a TTY, nothing to do
    }

    // Pause and cleanup the pipe
    process.stdin.pause();
    process.stdin.removeAllListeners();

    try {
      // Open /dev/tty directly for keyboard input
      const fs = await import('fs');
      const tty = await import('tty');

      const fd = fs.openSync('/dev/tty', 'r+');
      const newStdin: any = new tty.ReadStream(fd);

      // Configure for raw mode
      if (newStdin.setRawMode) {
        newStdin.setRawMode(false); // Let blessed handle raw mode
      }

      // Replace process.stdin
      Object.defineProperty(process, 'stdin', {
        value: newStdin,
        writable: false,
        configurable: true,
      });
    } catch (error) {
      // Can't open /dev/tty - provide helpful error
      throw new Error(
        'Cannot open /dev/tty for keyboard input after reading from pipe.\n' +
        'Workaround: Use --file option instead:\n' +
        '  git diff | reviewed-patch          # Won\'t work\n' +
        '  git diff > /tmp/changes.diff\n' +
        '  reviewed-patch --file /tmp/changes.diff  # Works!'
      );
    }
  }

  /**
   * Read diff from file
   */
  async readFile(filePath: string): Promise<string> {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return await readFile(filePath, 'utf-8');
  }

  /**
   * Read diff from stdin or file based on input
   * If reading from stdin, save to temp file and return the path
   * This allows us to re-use stdin for blessed keyboard input
   */
  async read(filePath?: string): Promise<{ content: string; usedStdin: boolean }> {
    if (filePath) {
      const content = await this.readFile(filePath);
      return { content, usedStdin: false };
    }

    // Check if stdin has data
    if (process.stdin.isTTY) {
      throw new Error('No input provided. Pipe a diff to stdin or use --file option.');
    }

    const content = await this.readStdin();
    return { content, usedStdin: true };
  }
}
