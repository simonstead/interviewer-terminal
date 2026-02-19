import { CommandContext } from '../terminal/CommandContext';

type EvalFn = (ctx: CommandContext, raw: string, exitCode: number) => boolean;

interface ObjectiveRule {
  id: string;
  evaluate: EvalFn;
}

const PROJECT_ROOT = '/opt/fleetcore';

// --- Helper functions ---

function cmd(pattern: RegExp): EvalFn {
  return (_ctx, raw) => pattern.test(raw);
}

function fileContainsAny(path: string, patterns: RegExp[]): EvalFn {
  return (ctx) => {
    const content = ctx.fs.readFile(path, '/');
    if (!content) return false;
    return patterns.some(p => p.test(content));
  };
}

function fileContainsAll(path: string, patterns: RegExp[]): EvalFn {
  return (ctx) => {
    const content = ctx.fs.readFile(path, '/');
    if (!content) return false;
    return patterns.every(p => p.test(content));
  };
}

/** Walk the VFS tree and return all file paths under basePath */
function getAllFiles(ctx: CommandContext, basePath: string): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    const entries = ctx.fs.listDir(dir, '/');
    if (!entries) return;
    for (const entry of entries) {
      const path = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
      if (entry.type === 'file') {
        files.push(path);
      } else if (entry.type === 'directory') {
        walk(path);
      }
    }
  };
  walk(basePath);
  return files;
}

function anyFileContainsAny(basePath: string, patterns: RegExp[]): EvalFn {
  return (ctx) => {
    const files = getAllFiles(ctx, basePath);
    for (const file of files) {
      const content = ctx.fs.readFile(file, '/');
      if (!content) continue;
      if (patterns.some(p => p.test(content))) return true;
    }
    return false;
  };
}

function anyFileContainsAll(basePath: string, patterns: RegExp[]): EvalFn {
  return (ctx) => {
    const files = getAllFiles(ctx, basePath);
    for (const file of files) {
      const content = ctx.fs.readFile(file, '/');
      if (!content) continue;
      if (patterns.every(p => p.test(content))) return true;
    }
    return false;
  };
}

function commandWritesTo(filePattern: RegExp): EvalFn {
  return (_ctx, raw) => {
    const match = raw.match(/>\s*(\S+)/);
    return match !== null && filePattern.test(match[1]);
  };
}

function dirHasMoreThan(dirPath: string, count: number): EvalFn {
  return (ctx) => {
    const entries = ctx.fs.listDir(dirPath, '/');
    if (!entries) return false;
    return entries.filter(e => e.type === 'file').length > count;
  };
}

function or(...fns: EvalFn[]): EvalFn {
  return (ctx, raw, exitCode) => fns.some(fn => fn(ctx, raw, exitCode));
}

// --- Level 1: Shell & DevOps ---

const LEVEL_1_RULES: ObjectiveRule[] = [
  {
    id: 'l1-explore',
    evaluate: (ctx, raw) => {
      const firstCmd = raw.trim().split(/\s+/)[0];
      return ['ls', 'tree', 'find'].includes(firstCmd) && ctx.cwd.startsWith(PROJECT_ROOT);
    },
  },
  {
    id: 'l1-readme',
    evaluate: cmd(/cat\s+.*README\.md/i),
  },
  {
    id: 'l1-docker-up',
    evaluate: cmd(/docker[\s-]compose\s+up|docker\s+compose\s+up/),
  },
  {
    id: 'l1-verify',
    evaluate: cmd(/curl\s+.*(?:localhost|127\.0\.0\.1).*\/health/),
  },
  {
    id: 'l1-logs',
    evaluate: cmd(/(?:cat|tail|less)\s+.*\.log/),
  },
  {
    id: 'l1-debug-redis',
    evaluate: cmd(/cat\s+.*error\.log|grep\s+.*[Rr]edis/),
  },
  {
    id: 'l1-fix-compose',
    evaluate: commandWritesTo(/docker-compose\.ya?ml/),
  },
];

// --- Level 2: API Development ---

const LEVEL_2_RULES: ObjectiveRule[] = [
  {
    id: 'l2-list',
    evaluate: cmd(/curl\s+.*\/api\/v1\/vehicles/),
  },
  {
    id: 'l2-create',
    evaluate: fileContainsAny(`${PROJECT_ROOT}/src/api/vehicles.ts`, [/\.post\s*\(/, /post\s*\(/i]),
  },
  {
    id: 'l2-filter',
    evaluate: fileContainsAny(`${PROJECT_ROOT}/src/api/vehicles.ts`, [/req\.query/, /query\./]),
  },
  {
    id: 'l2-pagination',
    evaluate: fileContainsAll(`${PROJECT_ROOT}/src/api/vehicles.ts`, [/limit/i, /offset/i]),
  },
  {
    id: 'l2-auth',
    evaluate: fileContainsAny(`${PROJECT_ROOT}/src/middleware/auth.ts`, [/jwt/i, /verify/i, /token/i]),
  },
  {
    id: 'l2-rate-limit',
    evaluate: anyFileContainsAny(PROJECT_ROOT, [/rateLimit/, /rate[\.\-_]limit/i, /throttle/i]),
  },
  {
    id: 'l2-versioning',
    evaluate: anyFileContainsAll(PROJECT_ROOT, [/version/i, /api/i]),
  },
];

// --- Level 3: Platform & Data ---

const LEVEL_3_RULES: ObjectiveRule[] = [
  {
    id: 'l3-query',
    evaluate: anyFileContainsAll(PROJECT_ROOT, [/SELECT/i, /WHERE/i, /vehicles/i]),
  },
  {
    id: 'l3-migration',
    evaluate: dirHasMoreThan(`${PROJECT_ROOT}/src/db/migrations`, 2),
  },
  {
    id: 'l3-optimize',
    evaluate: anyFileContainsAny(PROJECT_ROOT, [/CREATE\s+INDEX/i, /EXPLAIN/i]),
  },
  {
    id: 'l3-caching',
    evaluate: or(
      fileContainsAny(`${PROJECT_ROOT}/src/utils/cache.ts`, [/redis/i, /cache\.set/i]),
      fileContainsAny(`${PROJECT_ROOT}/src/services/VehicleService.ts`, [/redis/i, /cache\.set/i]),
    ),
  },
  {
    id: 'l3-pipeline',
    evaluate: anyFileContainsAny(PROJECT_ROOT, [/\bpipeline\b/i, /\btelemetry\b/i]),
  },
];

// --- Level 4: Architecture & Business ---

const LEVEL_4_RULES: ObjectiveRule[] = [
  {
    id: 'l4-adr',
    evaluate: anyFileContainsAll(PROJECT_ROOT, [/Decision/i, /Context/i, /Consequences/i]),
  },
  {
    id: 'l4-scaling',
    evaluate: anyFileContainsAny(PROJECT_ROOT, [/\bscal(?:e|ing|ability)\b/i, /\bhorizontal\b/i, /\bpartition/i]),
  },
  {
    id: 'l4-budget',
    evaluate: anyFileContainsAll(PROJECT_ROOT, [/\bcost\b/i, /(?:run\s*rate|budget)/i]),
  },
  {
    id: 'l4-team',
    evaluate: anyFileContainsAll(PROJECT_ROOT, [/\bteam\b/i, /(?:structure|engineer)/i]),
  },
  {
    id: 'l4-sla',
    evaluate: anyFileContainsAny(PROJECT_ROOT, [/\bSLA\b/, /\buptime\b/i, /\bavailability\b/i]),
  },
];

const RULES_BY_LEVEL: Record<number, ObjectiveRule[]> = {
  1: LEVEL_1_RULES,
  2: LEVEL_2_RULES,
  3: LEVEL_3_RULES,
  4: LEVEL_4_RULES,
};

export class LevelEvaluator {
  /**
   * Evaluate objectives for the current level against the latest command and VFS state.
   * Returns IDs of newly completed objectives.
   */
  static evaluate(ctx: CommandContext, raw: string, exitCode: number): string[] {
    if (exitCode !== 0) return [];

    const level = ctx.challenge.currentLevel;
    const rules = RULES_BY_LEVEL[level];
    if (!rules) return [];

    const completed = ctx.challenge.completedObjectives;
    const newlyCompleted: string[] = [];

    for (const rule of rules) {
      if (completed.includes(rule.id)) continue;
      try {
        if (rule.evaluate(ctx, raw, exitCode)) {
          newlyCompleted.push(rule.id);
        }
      } catch {
        // Rule evaluation failed — skip silently
      }
    }

    return newlyCompleted;
  }
}
