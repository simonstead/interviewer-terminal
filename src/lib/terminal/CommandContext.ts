import { VirtualFileSystem } from './VirtualFileSystem';

export interface ChallengeState {
  currentLevel: number;
  seniority: 'junior' | 'mid' | 'senior' | 'lead' | 'principal';
  completedObjectives: string[];
  hintsUsed: string[];
  startTime: number;
  levelStartTime: number;
}

export class CommandContext {
  cwd: string;
  env: Record<string, string>;
  fs: VirtualFileSystem;
  challenge: ChallengeState;
  exitCode: number;
  user: string;
  hostname: string;

  constructor(fs: VirtualFileSystem, seniority: ChallengeState['seniority'] = 'mid') {
    this.fs = fs;
    this.cwd = '/opt/fleetcore';
    this.env = {
      HOME: '/home/candidate',
      USER: 'candidate',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      SHELL: '/bin/bash',
      TERM: 'xterm-256color',
      NODE_ENV: 'development',
      PWD: '/opt/fleetcore',
    };
    this.challenge = {
      currentLevel: 1,
      seniority,
      completedObjectives: [],
      hintsUsed: [],
      startTime: Date.now(),
      levelStartTime: Date.now(),
    };
    this.exitCode = 0;
    this.user = 'candidate';
    this.hostname = 'fleetcore';
  }

  get prompt(): string {
    const cwdDisplay = this.cwd === this.env.HOME
      ? '~'
      : this.cwd.startsWith(this.env.HOME)
        ? '~' + this.cwd.slice(this.env.HOME.length)
        : this.cwd;
    return `\x1b[32m${this.user}@${this.hostname}\x1b[0m:\x1b[34m${cwdDisplay}\x1b[0m$ `;
  }

  resolvePath(path: string): string {
    // Expand ~ to home directory
    if (path.startsWith('~')) {
      path = this.env.HOME + path.slice(1);
    }
    // Expand environment variables
    path = path.replace(/\$(\w+)/g, (_, name) => this.env[name] || '');
    path = path.replace(/\$\{(\w+)\}/g, (_, name) => this.env[name] || '');
    return this.fs.resolvePath(path, this.cwd);
  }
}
