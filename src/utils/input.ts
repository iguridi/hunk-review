import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export class InputReader {
  /**
   * Read diff from stdin
   */
  async readStdin(): Promise<string> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      process.stdin.on('error', (error) => reject(error));
    });
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
   */
  async read(filePath?: string): Promise<string> {
    if (filePath) {
      return await this.readFile(filePath);
    }

    // Check if stdin has data
    if (process.stdin.isTTY) {
      throw new Error('No input provided. Pipe a diff to stdin or use --file option.');
    }

    return await this.readStdin();
  }
}
