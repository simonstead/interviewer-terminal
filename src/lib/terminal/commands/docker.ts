import { CommandRegistry, CommandResult } from '../CommandRegistry';
import { ParsedCommand } from '../CommandParser';
import { CommandContext } from '../CommandContext';

interface ContainerState {
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'created';
  ports: string;
  created: string;
  id: string;
}

// Global docker state (persists across commands)
const dockerState = {
  containers: new Map<string, ContainerState>(),
  initialized: false,
};

function initDockerState() {
  if (dockerState.initialized) return;
  dockerState.initialized = true;

  // Pre-configured containers that match docker-compose.yml
  const containers: ContainerState[] = [
    {
      name: 'fleetcore-api',
      image: 'fleetcore-api:latest',
      status: 'stopped',
      ports: '',
      created: '2 days ago',
      id: 'a1b2c3d4e5f6',
    },
    {
      name: 'fleetcore-db',
      image: 'postgres:15-alpine',
      status: 'stopped',
      ports: '',
      created: '2 days ago',
      id: 'b2c3d4e5f6a1',
    },
    {
      name: 'fleetcore-cache',
      image: 'redis:7-alpine',
      status: 'stopped',
      ports: '',
      created: '2 days ago',
      id: 'c3d4e5f6a1b2',
    },
  ];

  for (const c of containers) {
    dockerState.containers.set(c.name, c);
  }
}

export function registerDockerCommands(registry: CommandRegistry): void {
  registry.register('docker', handleDocker);
  registry.register('docker-compose', handleDockerCompose);
}

function handleDocker(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  initDockerState();
  const subcommand = cmd.args[0];

  switch (subcommand) {
    case 'ps':
      return dockerPs(cmd);
    case 'images':
      return dockerImages();
    case 'logs':
      return dockerLogs(cmd);
    case 'start':
      return dockerStart(cmd);
    case 'stop':
      return dockerStop(cmd);
    case 'exec':
      return dockerExec(cmd, ctx);
    case 'inspect':
      return dockerInspect(cmd);
    case 'compose':
      return handleDockerCompose({ ...cmd, args: cmd.args.slice(1) }, ctx);
    case 'version':
    case '--version':
      return {
        output: 'Docker version 24.0.7, build afdd53b',
        exitCode: 0,
      };
    default:
      return {
        output: `docker: '${subcommand}' is not a docker command.\nSee 'docker --help'`,
        exitCode: 1,
      };
  }
}

function dockerPs(cmd: ParsedCommand): CommandResult {
  const showAll = cmd.flags['a'] === true || cmd.rawArgs.includes('-a');
  const containers = Array.from(dockerState.containers.values());
  const filtered = showAll ? containers : containers.filter(c => c.status === 'running');

  if (filtered.length === 0) {
    if (showAll) {
      const header = 'CONTAINER ID   IMAGE                    COMMAND                  CREATED       STATUS    PORTS     NAMES';
      const lines = containers.map(c => {
        const id = c.id.slice(0, 12);
        const image = c.image.padEnd(24);
        const command = '"docker-entrypoint.s…"'.padEnd(24);
        const created = c.created.padEnd(13);
        const status = (c.status === 'running'
          ? `Up ${c.created}`
          : `Exited (0) ${c.created}`).padEnd(24);
        const ports = (c.status === 'running' ? c.ports : '').padEnd(9);
        return `${id}   ${image} ${command} ${created} ${status} ${ports} ${c.name}`;
      });
      return { output: header + '\n' + lines.join('\n'), exitCode: 0 };
    }
    return { output: 'CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES', exitCode: 0 };
  }

  const header = 'CONTAINER ID   IMAGE                    COMMAND                  CREATED       STATUS          PORTS                    NAMES';
  const lines = filtered.map(c => {
    const id = c.id.slice(0, 12);
    const image = c.image.padEnd(24);
    const command = '"docker-entrypoint.s…"'.padEnd(24);
    const created = c.created.padEnd(13);
    const status = (c.status === 'running'
      ? `Up ${c.created}`
      : `Exited (0) ${c.created}`).padEnd(15);
    const ports = (c.status === 'running' ? c.ports : '').padEnd(24);
    return `${id}   ${image} ${command} ${created} ${status} ${ports} ${c.name}`;
  });

  return { output: header + '\n' + lines.join('\n'), exitCode: 0 };
}

function dockerImages(): CommandResult {
  const images = [
    { repo: 'fleetcore-api', tag: 'latest', id: 'sha256:abc123', created: '2 days ago', size: '285MB' },
    { repo: 'postgres', tag: '15-alpine', id: 'sha256:def456', created: '2 weeks ago', size: '235MB' },
    { repo: 'redis', tag: '7-alpine', id: 'sha256:ghi789', created: '2 weeks ago', size: '30.4MB' },
    { repo: 'node', tag: '20-alpine', id: 'sha256:jkl012', created: '3 weeks ago', size: '177MB' },
  ];

  const header = 'REPOSITORY      TAG          IMAGE ID       CREATED        SIZE';
  const lines = images.map(i =>
    `${i.repo.padEnd(15)} ${i.tag.padEnd(12)} ${i.id.slice(0, 12).padEnd(14)} ${i.created.padEnd(14)} ${i.size}`
  );

  return { output: header + '\n' + lines.join('\n'), exitCode: 0 };
}

function dockerLogs(cmd: ParsedCommand): CommandResult {
  const containerName = cmd.args[1];
  if (!containerName) {
    return { output: 'docker logs: requires exactly 1 argument', exitCode: 1 };
  }

  const container = dockerState.containers.get(containerName) ||
    Array.from(dockerState.containers.values()).find(c => c.id.startsWith(containerName));

  if (!container) {
    return { output: `Error: No such container: ${containerName}`, exitCode: 1 };
  }

  if (container.status !== 'running') {
    return { output: `Error: Container ${containerName} is not running`, exitCode: 1 };
  }

  const logsByContainer: Record<string, string> = {
    'fleetcore-api': `[2024-01-15T08:32:01.234Z] INFO: FleetCore API starting...
[2024-01-15T08:32:01.456Z] INFO: Connecting to database...
[2024-01-15T08:32:02.123Z] INFO: Database connection established
[2024-01-15T08:32:02.234Z] INFO: Connecting to Redis...
[2024-01-15T08:32:02.456Z] INFO: Redis connection established
[2024-01-15T08:32:02.567Z] INFO: Loading routes...
[2024-01-15T08:32:02.678Z] INFO: FleetCore API running on port 3000
[2024-01-15T08:33:15.112Z] INFO: GET /health 200 2ms
[2024-01-15T08:34:22.445Z] INFO: GET /api/v1/vehicles 200 45ms`,
    'fleetcore-db': `PostgreSQL Database directory appears to contain a database; Skipping initialization
2024-01-15 08:32:01.000 UTC [1] LOG:  starting PostgreSQL 15.5 on x86_64-pc-linux-musl
2024-01-15 08:32:01.000 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432
2024-01-15 08:32:01.100 UTC [1] LOG:  database system is ready to accept connections`,
    'fleetcore-cache': `1:C 15 Jan 2024 08:32:02.000 # oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo
1:C 15 Jan 2024 08:32:02.000 # Redis version=7.2.4, bits=64, commit=00000000
1:M 15 Jan 2024 08:32:02.001 * Running mode=standalone, port=6379.
1:M 15 Jan 2024 08:32:02.001 # Server initialized
1:M 15 Jan 2024 08:32:02.001 * Ready to accept connections tcp`,
  };

  const logs = logsByContainer[container.name] || 'No logs available.';
  return { output: logs, exitCode: 0 };
}

function dockerStart(cmd: ParsedCommand): CommandResult {
  const containerName = cmd.args[1];
  if (!containerName) {
    return { output: 'docker start: requires at least 1 argument', exitCode: 1 };
  }

  const container = dockerState.containers.get(containerName);
  if (!container) {
    return { output: `Error: No such container: ${containerName}`, exitCode: 1 };
  }

  container.status = 'running';
  updatePorts(container);
  return { output: containerName, exitCode: 0 };
}

function dockerStop(cmd: ParsedCommand): CommandResult {
  const containerName = cmd.args[1];
  if (!containerName) {
    return { output: 'docker stop: requires at least 1 argument', exitCode: 1 };
  }

  const container = dockerState.containers.get(containerName);
  if (!container) {
    return { output: `Error: No such container: ${containerName}`, exitCode: 1 };
  }

  container.status = 'stopped';
  container.ports = '';
  return { output: containerName, exitCode: 0 };
}

function dockerExec(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  // docker exec -it container command
  const containerIdx = cmd.args.findIndex((a, i) => i > 0 && !a.startsWith('-'));
  if (containerIdx === -1) {
    return { output: 'docker exec: requires at least 2 arguments', exitCode: 1 };
  }

  const containerName = cmd.args[containerIdx];
  const execCmd = cmd.args.slice(containerIdx + 1).join(' ');
  const container = dockerState.containers.get(containerName);

  if (!container) {
    return { output: `Error: No such container: ${containerName}`, exitCode: 1 };
  }
  if (container.status !== 'running') {
    return { output: `Error: Container ${containerName} is not running`, exitCode: 1 };
  }

  // Simulate some common exec commands
  if (execCmd.includes('psql') || execCmd.includes('pg_isready')) {
    if (container.name === 'fleetcore-db') {
      if (execCmd.includes('pg_isready')) {
        return { output: '/var/run/postgresql:5432 - accepting connections', exitCode: 0 };
      }
      return { output: 'psql (15.5)\nType "help" for help.\n\nfleetcore=#', exitCode: 0 };
    }
  }

  if (execCmd.includes('redis-cli') && container.name === 'fleetcore-cache') {
    if (execCmd.includes('ping')) {
      return { output: 'PONG', exitCode: 0 };
    }
    return { output: '127.0.0.1:6379>', exitCode: 0 };
  }

  return { output: `OCI runtime exec failed: exec: "${execCmd}": executable file not found in $PATH`, exitCode: 1 };
}

function dockerInspect(cmd: ParsedCommand): CommandResult {
  const containerName = cmd.args[1];
  if (!containerName) {
    return { output: 'docker inspect: requires at least 1 argument', exitCode: 1 };
  }

  const container = dockerState.containers.get(containerName);
  if (!container) {
    return { output: `Error: No such object: ${containerName}`, exitCode: 1 };
  }

  const inspect = {
    Id: container.id + '0'.repeat(52),
    Created: '2024-01-13T10:00:00.000000000Z',
    State: {
      Status: container.status,
      Running: container.status === 'running',
      Pid: container.status === 'running' ? 12345 : 0,
    },
    Name: `/${container.name}`,
    Config: {
      Image: container.image,
    },
    NetworkSettings: {
      Ports: container.status === 'running' ? { '3000/tcp': [{ HostPort: '3000' }] } : {},
    },
  };

  return { output: JSON.stringify([inspect], null, 2), exitCode: 0 };
}

function handleDockerCompose(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  initDockerState();
  const subcommand = cmd.args[0];

  switch (subcommand) {
    case 'up': {
      const detached = cmd.flags['d'] === true || cmd.rawArgs.includes('-d');
      const containers = Array.from(dockerState.containers.values());

      for (const c of containers) {
        c.status = 'running';
        updatePorts(c);
      }

      const output = containers.map(c =>
        `\x1b[32m ✔ \x1b[0mContainer ${c.name}  \x1b[32mStarted\x1b[0m`
      ).join('\n');

      return {
        output: `\x1b[1mNetwork fleetcore_default  Created\x1b[0m\n${output}`,
        exitCode: 0,
      };
    }

    case 'down': {
      const containers = Array.from(dockerState.containers.values());
      for (const c of containers) {
        c.status = 'stopped';
        c.ports = '';
      }

      const output = containers.map(c =>
        `\x1b[32m ✔ \x1b[0mContainer ${c.name}  \x1b[32mStopped\x1b[0m`
      ).join('\n');

      return {
        output: `${output}\n\x1b[1mNetwork fleetcore_default  Removed\x1b[0m`,
        exitCode: 0,
      };
    }

    case 'ps': {
      const containers = Array.from(dockerState.containers.values());
      const header = 'NAME               IMAGE                    SERVICE   CREATED       STATUS          PORTS';
      const lines = containers.map(c => {
        const serviceName = c.name.replace('fleetcore-', '');
        const status = c.status === 'running' ? `Up ${c.created}` : `Exited (0)`;
        return `${c.name.padEnd(18)} ${c.image.padEnd(24)} ${serviceName.padEnd(9)} ${c.created.padEnd(13)} ${status.padEnd(15)} ${c.ports}`;
      });
      return { output: header + '\n' + lines.join('\n'), exitCode: 0 };
    }

    case 'logs': {
      const service = cmd.args[1];
      if (service) {
        const container = Array.from(dockerState.containers.values())
          .find(c => c.name.endsWith(service));
        if (container) {
          return dockerLogs({ ...cmd, args: ['logs', container.name] });
        }
      }
      return { output: 'Attaching to fleetcore-api, fleetcore-db, fleetcore-cache\n...', exitCode: 0 };
    }

    case 'build': {
      return {
        output: `Building api\n[+] Building 12.3s (10/10) FINISHED\n => [internal] load build definition from Dockerfile\n => [1/4] FROM node:20-alpine\n => [2/4] COPY package*.json ./\n => [3/4] RUN npm ci\n => [4/4] COPY . .\n => exporting to image\n\x1b[32mSuccessfully built fleetcore-api:latest\x1b[0m`,
        exitCode: 0,
      };
    }

    case 'restart': {
      const containers = Array.from(dockerState.containers.values());
      const output = containers.map(c =>
        `\x1b[32m ✔ \x1b[0mContainer ${c.name}  \x1b[32mRestarted\x1b[0m`
      ).join('\n');
      return { output, exitCode: 0 };
    }

    case 'version':
    case '--version':
      return {
        output: 'Docker Compose version v2.23.3',
        exitCode: 0,
      };

    default:
      return {
        output: `docker-compose: '${subcommand}' is not a command.\nSee 'docker-compose --help'`,
        exitCode: 1,
      };
  }
}

function updatePorts(container: ContainerState): void {
  const portMap: Record<string, string> = {
    'fleetcore-api': '0.0.0.0:3000->3000/tcp',
    'fleetcore-db': '0.0.0.0:5432->5432/tcp',
    'fleetcore-cache': '0.0.0.0:6379->6379/tcp',
  };
  container.ports = portMap[container.name] || '';
}
