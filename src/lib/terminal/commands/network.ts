import { CommandRegistry, CommandResult } from '../CommandRegistry';
import { ParsedCommand } from '../CommandParser';
import { CommandContext } from '../CommandContext';

export function registerNetworkCommands(registry: CommandRegistry): void {
  registry.register('curl', handleCurl);
  registry.register('wget', handleWget);
  registry.register('ping', handlePing);
  registry.register('netstat', handleNetstat);
  registry.register('ss', handleNetstat);
}

function handleCurl(cmd: ParsedCommand, ctx: CommandContext): CommandResult {
  if (cmd.args.length === 0) {
    return { output: 'curl: try \'curl --help\' for more information', exitCode: 2 };
  }

  if (cmd.args[0] === '--version' || cmd.args[0] === '-V') {
    return { output: 'curl 8.5.0 (x86_64-pc-linux-gnu) libcurl/8.5.0 OpenSSL/3.1.4', exitCode: 0 };
  }

  // Find the URL argument (skip flags)
  let url = '';
  let method = 'GET';
  let dataBody = '';
  let showHeaders = false;

  for (let i = 0; i < cmd.args.length; i++) {
    const arg = cmd.args[i];
    if (arg === '-X' && i + 1 < cmd.args.length) {
      method = cmd.args[++i];
      continue;
    }
    if (arg === '-d' || arg === '--data') {
      dataBody = cmd.args[++i] || '';
      if (method === 'GET') method = 'POST';
      continue;
    }
    if (arg === '-H' || arg === '--header') {
      i++; // skip header value
      continue;
    }
    if (arg === '-i' || arg === '-I' || arg === '--include' || arg === '--head') {
      showHeaders = true;
      if (arg === '-I' || arg === '--head') method = 'HEAD';
      continue;
    }
    if (arg === '-s' || arg === '--silent' || arg === '-o' || arg === '-L' || arg === '-f' || arg === '-v') {
      if (arg === '-o') i++; // skip output file
      continue;
    }
    if (!arg.startsWith('-')) {
      url = arg;
    }
  }

  if (!url) {
    return { output: 'curl: no URL specified', exitCode: 3 };
  }

  return generateCurlResponse(url, method, dataBody, showHeaders);
}

function generateCurlResponse(url: string, method: string, body: string, showHeaders: boolean): CommandResult {
  const headers = showHeaders ? `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nX-Powered-By: Express\r\nDate: ${new Date().toUTCString()}\r\n\r\n` : '';

  // localhost:3000 endpoints (FleetCore API)
  if (url.includes('localhost:3000') || url.includes('127.0.0.1:3000') || url.includes('api:3000')) {
    const path = url.replace(/https?:\/\/[^/]+/, '');

    if (path === '/health' || path === '/health/') {
      return {
        output: headers + JSON.stringify({ status: 'ok', version: '2.4.1', uptime: 1234.567 }, null, 2),
        exitCode: 0,
      };
    }

    if (path.startsWith('/api/v1/vehicles') && method === 'GET') {
      if (path.match(/\/api\/v1\/vehicles\/[\w-]+$/)) {
        return {
          output: headers + JSON.stringify({
            data: {
              id: 'v-001',
              vin: '1HGCM82633A004352',
              make: 'Ford',
              model: 'Transit',
              year: 2023,
              licensePlate: 'FC-001',
              status: 'active',
              mileage: 12450,
              fuelLevel: 73.5,
            }
          }, null, 2),
          exitCode: 0,
        };
      }
      return {
        output: headers + JSON.stringify({
          data: [
            { id: 'v-001', vin: '1HGCM82633A004352', make: 'Ford', model: 'Transit', year: 2023, licensePlate: 'FC-001', status: 'active', mileage: 12450 },
            { id: 'v-002', vin: '2T1BURHE0JC067841', make: 'Mercedes', model: 'Sprinter', year: 2022, licensePlate: 'FC-002', status: 'active', mileage: 34200 },
            { id: 'v-003', vin: '3FADP4BJ7KM123456', make: 'Volvo', model: 'FH16', year: 2024, licensePlate: 'FC-003', status: 'maintenance', mileage: 5600 },
          ],
          total: 3,
        }, null, 2),
        exitCode: 0,
      };
    }

    if (path.startsWith('/api/v1/vehicles') && method === 'POST') {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(body); } catch {}
      return {
        output: headers + JSON.stringify({
          data: {
            id: 'v-' + Math.random().toString(36).slice(2, 5),
            ...parsed,
            status: 'active',
            createdAt: new Date().toISOString(),
          }
        }, null, 2),
        exitCode: 0,
      };
    }

    if (path.startsWith('/api/v1/drivers')) {
      return {
        output: headers + JSON.stringify({ data: [], total: 0 }, null, 2),
        exitCode: 0,
      };
    }

    if (path.startsWith('/api/v1/trips')) {
      return {
        output: headers + JSON.stringify({ data: [], total: 0 }, null, 2),
        exitCode: 0,
      };
    }

    // 404 for unknown paths
    const notFoundHeaders = showHeaders ? `HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n\r\n` : '';
    return {
      output: notFoundHeaders + JSON.stringify({ error: 'Not Found' }),
      exitCode: 0,
    };
  }

  // Default: connection refused or generic response
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return { output: `curl: (7) Failed to connect to ${url} port: Connection refused`, exitCode: 7 };
  }

  return {
    output: headers + '<html><body>OK</body></html>',
    exitCode: 0,
  };
}

function handleWget(cmd: ParsedCommand): CommandResult {
  if (cmd.args.length === 0) {
    return { output: 'wget: missing URL', exitCode: 1 };
  }
  if (cmd.args[0] === '--version') {
    return { output: 'GNU Wget 1.21.4', exitCode: 0 };
  }

  const url = cmd.args.find(a => !a.startsWith('-')) || cmd.args[0];
  return {
    output: `--${new Date().toISOString()}--  ${url}\nResolving... connected.\nHTTP request sent, awaiting response... 200 OK\nLength: 1234 (1.2K) [text/html]\nSaving to: 'index.html'\n\nindex.html          100%[===================>]  1.2K  --.-KB/s    in 0s\n\n${new Date().toISOString()} (5.42 MB/s) - 'index.html' saved [1234/1234]`,
    exitCode: 0,
  };
}

function handlePing(cmd: ParsedCommand): CommandResult {
  const host = cmd.args[0];
  if (!host) {
    return { output: 'ping: usage error: Destination address required', exitCode: 1 };
  }

  const lines = [
    `PING ${host} (172.18.0.2) 56(84) bytes of data.`,
    `64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.045 ms`,
    `64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.039 ms`,
    `64 bytes from ${host}: icmp_seq=3 ttl=64 time=0.041 ms`,
    '',
    `--- ${host} ping statistics ---`,
    `3 packets transmitted, 3 received, 0% packet loss, time 2004ms`,
    `rtt min/avg/max/mdev = 0.039/0.042/0.045/0.002 ms`,
  ];

  return { output: lines.join('\n'), exitCode: 0 };
}

function handleNetstat(): CommandResult {
  const lines = [
    'Active Internet connections (only servers)',
    'Proto Recv-Q Send-Q Local Address           Foreign Address         State',
    'tcp        0      0 0.0.0.0:3000            0.0.0.0:*               LISTEN',
    'tcp        0      0 0.0.0.0:5432            0.0.0.0:*               LISTEN',
    'tcp        0      0 0.0.0.0:6379            0.0.0.0:*               LISTEN',
  ];
  return { output: lines.join('\n'), exitCode: 0 };
}
