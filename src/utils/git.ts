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
    try {
      // Try to get from remote origin
      const remote = execSync('git remote get-url origin', {
        cwd: gitDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      // Extract repo name from URL
      // e.g., git@github.com:user/repo.git -> repo
      // e.g., https://github.com/user/repo.git -> repo
      const match = remote.match(/\/([^\/]+?)(\.git)?$/);
      if (match && match[1]) {
        return match[1];
      }
    } catch {
      // Fall back to directory name
    }

    // Use directory name as fallback
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
