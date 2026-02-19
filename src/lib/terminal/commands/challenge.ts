import { CommandRegistry, CommandResult } from '../CommandRegistry';
import { ParsedCommand } from '../CommandParser';
import { CommandContext } from '../CommandContext';

export function registerChallengeCommands(registry: CommandRegistry): void {
  registry.register('status', handleStatus);
  registry.register('hint', handleHint);
  registry.register('submit', handleSubmit);
  registry.register('next-level', handleNextLevel);
}

interface Objective {
  id: string;
  title: string;
  description: string;
  seniorityMin: 'junior' | 'mid' | 'senior' | 'lead' | 'principal';
}

interface Hint {
  id: string;
  text: string;
  objectiveId: string;
  seniorityMax: 'junior' | 'mid' | 'senior' | 'lead' | 'principal';
}

export const SENIORITY_ORDER = ['junior', 'mid', 'senior', 'lead', 'principal'] as const;

export function seniorityLevel(s: string): number {
  return SENIORITY_ORDER.indexOf(s as typeof SENIORITY_ORDER[number]);
}

/** Get the number of objectives applicable for a given level and seniority */
export function getObjectivesForLevel(level: number, seniority: string): { total: number; ids: string[] } {
  const levelData = LEVELS[level];
  if (!levelData) return { total: 0, ids: [] };
  const userLevel = seniorityLevel(seniority);
  const applicable = levelData.objectives.filter(o => seniorityLevel(o.seniorityMin) <= userLevel);
  return { total: applicable.length, ids: applicable.map(o => o.id) };
}

/** Look up an objective's display title by its ID */
export function getObjectiveTitle(id: string): string | null {
  for (const level of Object.values(LEVELS)) {
    const obj = level.objectives.find(o => o.id === id);
    if (obj) return obj.title;
  }
  return null;
}

export const LEVELS: Record<number, { title: string; description: string; objectives: Objective[]; hints: Hint[] }> = {
  1: {
    title: 'Shell & DevOps',
    description: 'Navigate the FleetCore project, inspect services, and get the platform running.',
    objectives: [
      { id: 'l1-explore', title: 'Explore the project', description: 'Navigate to /opt/fleetcore and examine the project structure', seniorityMin: 'junior' },
      { id: 'l1-readme', title: 'Read the README', description: 'Read the README.md to understand the project architecture', seniorityMin: 'junior' },
      { id: 'l1-docker-up', title: 'Start services', description: 'Start all Docker containers using docker-compose', seniorityMin: 'junior' },
      { id: 'l1-verify', title: 'Verify services', description: 'Verify the API is running by hitting the health endpoint', seniorityMin: 'junior' },
      { id: 'l1-logs', title: 'Check logs', description: 'Check the application logs for any errors', seniorityMin: 'mid' },
      { id: 'l1-debug-redis', title: 'Diagnose Redis issue', description: 'Find and diagnose the Redis connection issue from the error logs', seniorityMin: 'senior' },
      { id: 'l1-fix-compose', title: 'Fix docker-compose', description: 'Identify and fix the configuration issue in docker-compose.yml', seniorityMin: 'senior' },
    ],
    hints: [
      { id: 'h1-1', text: 'Try using "cd /opt/fleetcore" to navigate to the project directory', objectiveId: 'l1-explore', seniorityMax: 'mid' },
      { id: 'h1-2', text: 'Use "cat README.md" to read the project documentation', objectiveId: 'l1-readme', seniorityMax: 'mid' },
      { id: 'h1-3', text: 'Run "docker-compose up -d" to start all services in the background', objectiveId: 'l1-docker-up', seniorityMax: 'junior' },
      { id: 'h1-4', text: 'Try "curl localhost:3000/health" to check if the API is responding', objectiveId: 'l1-verify', seniorityMax: 'junior' },
      { id: 'h1-5', text: 'Check the log files in /opt/fleetcore/logs/ directory', objectiveId: 'l1-logs', seniorityMax: 'mid' },
    ],
  },
  2: {
    title: 'API Development',
    description: 'Work with the FleetCore REST API - build and fix endpoints for vehicle tracking.',
    objectives: [
      { id: 'l2-list', title: 'List vehicles', description: 'Use the API to list all vehicles', seniorityMin: 'junior' },
      { id: 'l2-create', title: 'Create endpoint', description: 'Implement a POST endpoint to create a new vehicle', seniorityMin: 'junior' },
      { id: 'l2-filter', title: 'Add filtering', description: 'Add query parameter filtering to the vehicles list endpoint', seniorityMin: 'mid' },
      { id: 'l2-pagination', title: 'Add pagination', description: 'Implement pagination with limit/offset on the list endpoint', seniorityMin: 'mid' },
      { id: 'l2-auth', title: 'Auth middleware', description: 'Implement JWT authentication middleware', seniorityMin: 'senior' },
      { id: 'l2-rate-limit', title: 'Rate limiting', description: 'Add rate limiting to API endpoints', seniorityMin: 'senior' },
      { id: 'l2-versioning', title: 'API versioning', description: 'Design and document a full API versioning strategy', seniorityMin: 'lead' },
    ],
    hints: [
      { id: 'h2-1', text: 'Try "curl localhost:3000/api/v1/vehicles" to list vehicles', objectiveId: 'l2-list', seniorityMax: 'junior' },
      { id: 'h2-2', text: 'Look at src/api/vehicles.ts for the existing route handlers', objectiveId: 'l2-create', seniorityMax: 'junior' },
      { id: 'h2-3', text: 'Use req.query to access query parameters in Express', objectiveId: 'l2-filter', seniorityMax: 'mid' },
    ],
  },
  3: {
    title: 'Platform & Data',
    description: 'Database queries, caching strategy, and deployment configuration.',
    objectives: [
      { id: 'l3-query', title: 'Write SQL query', description: 'Write a query to find vehicles needing maintenance', seniorityMin: 'junior' },
      { id: 'l3-migration', title: 'Create migration', description: 'Create a database migration for a new trips table', seniorityMin: 'mid' },
      { id: 'l3-optimize', title: 'Query optimization', description: 'Optimize the vehicle query with proper indexing', seniorityMin: 'senior' },
      { id: 'l3-caching', title: 'Caching strategy', description: 'Implement Redis caching for the vehicle list endpoint', seniorityMin: 'senior' },
      { id: 'l3-pipeline', title: 'Data pipeline', description: 'Design a data pipeline for real-time GPS telemetry at scale', seniorityMin: 'lead' },
    ],
    hints: [
      { id: 'h3-1', text: 'Look at the vehicles table schema in the migrations directory', objectiveId: 'l3-query', seniorityMax: 'junior' },
      { id: 'h3-2', text: 'Use Knex.js migration patterns from the existing migration files', objectiveId: 'l3-migration', seniorityMax: 'mid' },
    ],
  },
  4: {
    title: 'Architecture & Business',
    description: 'System architecture, business decisions, and scaling strategy.',
    objectives: [
      { id: 'l4-adr', title: 'Architecture Decision', description: 'Write an Architecture Decision Record for the caching strategy', seniorityMin: 'senior' },
      { id: 'l4-scaling', title: 'Scaling plan', description: 'Design a plan to scale from 100 to 100,000 vehicles', seniorityMin: 'lead' },
      { id: 'l4-budget', title: 'Cost analysis', description: 'Analyze cloud costs and calculate run rates for the fleet platform', seniorityMin: 'principal' },
      { id: 'l4-team', title: 'Team structure', description: 'Recommend team structure for building and maintaining the platform', seniorityMin: 'principal' },
      { id: 'l4-sla', title: 'SLA design', description: 'Design SLAs for the fleet tracking system', seniorityMin: 'principal' },
    ],
    hints: [
      { id: 'h4-1', text: 'An ADR typically has: Title, Status, Context, Decision, Consequences', objectiveId: 'l4-adr', seniorityMax: 'senior' },
    ],
  },
};

function handleStatus(_cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const level = ctx.challenge.currentLevel;
  const levelData = LEVELS[level];
  if (!levelData) {
    return { output: 'Challenge complete! All levels finished.', exitCode: 0 };
  }

  const userSeniority = seniorityLevel(ctx.challenge.seniority);
  const objectives = levelData.objectives.filter(o =>
    seniorityLevel(o.seniorityMin) <= userSeniority
  );

  const lines: string[] = [
    '',
    `\x1b[1;36m═══ Level ${level}: ${levelData.title} ═══\x1b[0m`,
    `\x1b[37m${levelData.description}\x1b[0m`,
    '',
    '\x1b[1mObjectives:\x1b[0m',
  ];

  for (const obj of objectives) {
    const completed = ctx.challenge.completedObjectives.includes(obj.id);
    const icon = completed ? '\x1b[32m✓\x1b[0m' : '\x1b[33m○\x1b[0m';
    const title = completed ? `\x1b[90m${obj.title}\x1b[0m` : `\x1b[37m${obj.title}\x1b[0m`;
    lines.push(`  ${icon} ${title}`);
    if (!completed) {
      lines.push(`    \x1b[90m${obj.description}\x1b[0m`);
    }
  }

  const completedCount = objectives.filter(o =>
    ctx.challenge.completedObjectives.includes(o.id)
  ).length;

  lines.push('');
  lines.push(`\x1b[37mProgress: ${completedCount}/${objectives.length}\x1b[0m`);
  lines.push(`\x1b[37mHints used: ${ctx.challenge.hintsUsed.length}\x1b[0m`);
  lines.push('');
  lines.push('\x1b[90mType "hint" for a hint, "submit <objective-id>" to mark complete.\x1b[0m');
  lines.push('');

  return { output: lines.join('\n'), exitCode: 0 };
}

function handleHint(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const level = ctx.challenge.currentLevel;
  const levelData = LEVELS[level];
  if (!levelData) {
    return { output: 'No hints available.', exitCode: 0 };
  }

  const userSeniority = seniorityLevel(ctx.challenge.seniority);

  // Get available hints for current seniority
  const availableHints = levelData.hints.filter(h => {
    const maxLevel = seniorityLevel(h.seniorityMax);
    return userSeniority <= maxLevel && !ctx.challenge.hintsUsed.includes(h.id);
  });

  // If a specific objective is targeted
  const targetObj = cmd.args[0];
  if (targetObj) {
    const hint = availableHints.find(h => h.objectiveId === targetObj);
    if (hint) {
      ctx.challenge.hintsUsed.push(hint.id);
      return {
        output: `\n\x1b[33m💡 Hint:\x1b[0m ${hint.text}\n`,
        exitCode: 0,
      };
    }
    return { output: `No hint available for '${targetObj}'.`, exitCode: 0 };
  }

  // Give the next available hint
  if (availableHints.length === 0) {
    if (userSeniority >= seniorityLevel('senior')) {
      return { output: '\x1b[90mNo hints available at your seniority level. You\'re on your own!\x1b[0m', exitCode: 0 };
    }
    return { output: 'No more hints available for this level.', exitCode: 0 };
  }

  const hint = availableHints[0];
  ctx.challenge.hintsUsed.push(hint.id);

  return {
    output: `\n\x1b[33m💡 Hint:\x1b[0m ${hint.text}\n\n\x1b[90m${availableHints.length - 1} hints remaining\x1b[0m\n`,
    exitCode: 0,
  };
}

function handleSubmit(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const objectiveId = cmd.args[0];
  if (!objectiveId) {
    return { output: 'Usage: submit <objective-id>\nType "status" to see available objectives.', exitCode: 1 };
  }

  const level = ctx.challenge.currentLevel;
  const levelData = LEVELS[level];
  if (!levelData) {
    return { output: 'No active challenge.', exitCode: 1 };
  }

  const objective = levelData.objectives.find(o => o.id === objectiveId);
  if (!objective) {
    return { output: `Unknown objective: ${objectiveId}`, exitCode: 1 };
  }

  if (ctx.challenge.completedObjectives.includes(objectiveId)) {
    return { output: `Objective '${objective.title}' already completed!`, exitCode: 0 };
  }

  ctx.challenge.completedObjectives.push(objectiveId);

  const userSeniority = seniorityLevel(ctx.challenge.seniority);
  const totalForLevel = levelData.objectives.filter(o =>
    seniorityLevel(o.seniorityMin) <= userSeniority
  ).length;
  const completedForLevel = levelData.objectives.filter(o =>
    seniorityLevel(o.seniorityMin) <= userSeniority &&
    ctx.challenge.completedObjectives.includes(o.id)
  ).length;

  const lines = [
    '',
    `\x1b[32m✓ Objective completed: ${objective.title}\x1b[0m`,
    `  Progress: ${completedForLevel}/${totalForLevel}`,
  ];

  if (completedForLevel === totalForLevel) {
    lines.push('');
    lines.push('\x1b[1;32m🎉 Level complete!\x1b[0m');
    if (level < 4) {
      lines.push(`Type \x1b[1mnext-level\x1b[0m to advance to Level ${level + 1}.`);
    } else {
      lines.push('\x1b[1;36mCongratulations! You have completed all levels!\x1b[0m');
    }
  }

  lines.push('');
  return { output: lines.join('\n'), exitCode: 0 };
}

function handleNextLevel(_cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  const currentLevel = ctx.challenge.currentLevel;
  const levelData = LEVELS[currentLevel];
  if (!levelData) {
    return { output: 'Already at the final level.', exitCode: 0 };
  }

  const userSeniority = seniorityLevel(ctx.challenge.seniority);
  const totalForLevel = levelData.objectives.filter(o =>
    seniorityLevel(o.seniorityMin) <= userSeniority
  ).length;
  const completedForLevel = levelData.objectives.filter(o =>
    seniorityLevel(o.seniorityMin) <= userSeniority &&
    ctx.challenge.completedObjectives.includes(o.id)
  ).length;

  if (completedForLevel < totalForLevel) {
    return {
      output: `You haven't completed all objectives for Level ${currentLevel} yet.\nProgress: ${completedForLevel}/${totalForLevel}\nType "status" to see remaining objectives.`,
      exitCode: 1,
    };
  }

  if (currentLevel >= 4) {
    return { output: '\x1b[1;36mYou have completed all levels! Well done!\x1b[0m', exitCode: 0 };
  }

  // Advance to next level
  ctx.challenge.currentLevel = currentLevel + 1;
  ctx.challenge.levelStartTime = Date.now();

  const nextLevel = LEVELS[currentLevel + 1];
  const lines = [
    '',
    '\x1b[1;36m╔══════════════════════════════════════════════════════╗\x1b[0m',
    `\x1b[1;36m║\x1b[0m  \x1b[1;37mLevel ${currentLevel + 1}: ${nextLevel.title}\x1b[0m`.padEnd(66) + '\x1b[1;36m║\x1b[0m',
    '\x1b[1;36m╚══════════════════════════════════════════════════════╝\x1b[0m',
    '',
    `\x1b[37m${nextLevel.description}\x1b[0m`,
    '',
    'Type \x1b[1mstatus\x1b[0m to see your new objectives.',
    '',
  ];

  return { output: lines.join('\n'), exitCode: 0 };
}
