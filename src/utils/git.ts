import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface SessionInfo {
  repoName: string;
  branchName: string;
  sessionId: string;
}

export class GitHelper {
  /**
   * Get current session info (repo + branch)
   */
  static getCurrentSession(): SessionInfo | null {
    try {
      // Check if we're in a git repo
      const gitDir = this.findGitRoot();
      if (!gitDir) {
        return null;
      }

      // Get repo name from remote origin
      const repoName = this.getRepoName(gitDir);

      // Get current branch
      const branchName = this.getCurrentBranch(gitDir);

      // Create session ID
      const sessionId = `${repoName}:${branchName}`;

      return {
        repoName,
        branchName,
        sessionId,
      };
    } catch (error) {
      // Not in a git repo or git not available
      return null;
    }
  }

  private static findGitRoot(): string | null {
    try {
      const gitRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      return gitRoot;
    } catch {
      return null;
    }
  }

  private static getRepoName(gitDir: string): string {
    // Use directory name
    return gitDir.split('/').pop() || 'unknown';
  }

  private static getCurrentBranch(gitDir: string): string {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: gitDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      return branch;
    } catch {
      return 'unknown';
    }
  }
}
