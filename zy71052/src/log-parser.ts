import * as fs from 'fs';
import * as path from 'path';
import { GatewayLogEntry } from './types';

export function parseGatewayLogs(filePath: string): GatewayLogEntry[] {
  const logs: GatewayLogEntry[] = [];
  const stats = fs.statSync(filePath);

  if (stats.isDirectory()) {
    const files = fs.readdirSync(filePath)
      .filter(f => f.endsWith('.log') || f.endsWith('.json') || f.endsWith('.ndjson'))
      .map(f => path.join(filePath, f));
    
    for (const file of files) {
      logs.push(...parseSingleLogFile(file));
    }
  } else {
    logs.push(...parseSingleLogFile(filePath));
  }

  return sortLogs(logs);
}

function parseSingleLogFile(filePath: string): GatewayLogEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const logs: GatewayLogEntry[] = [];
  
  const lines = content.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const entry = normalizeLogEntry(parsed);
      if (entry) {
        logs.push(entry);
      }
    } catch {
      const parsed = parseTextLogLine(line);
      if (parsed) {
        logs.push(parsed);
      }
    }
  }

  return logs;
}

function normalizeLogEntry(obj: any): GatewayLogEntry | null {
  const timestamp = obj.timestamp || obj.time || obj.date || obj['@timestamp'];
  const clientId = obj.clientId || obj.client_id || obj.client || obj.appId || obj.app_id;
  const clientVersion = obj.clientVersion || obj.client_version || obj.version || obj.appVersion;
  const pathValue = obj.path || obj.url || obj.uri || obj.requestPath;
  const method = obj.method || obj.httpMethod || obj.request_method;
  const statusCode = obj.statusCode || obj.status || obj.http_status;
  const userAgent = obj.userAgent || obj.user_agent || obj.ua;
  const requestId = obj.requestId || obj.request_id || obj.traceId || obj.trace_id;

  if (!timestamp || !clientId || !pathValue || !method) {
    return null;
  }

  return {
    timestamp: String(timestamp),
    clientId: String(clientId),
    clientVersion: clientVersion ? String(clientVersion) : undefined,
    path: normalizePath(String(pathValue)),
    method: String(method).toUpperCase(),
    statusCode: parseInt(String(statusCode), 10) || 0,
    userAgent: userAgent ? String(userAgent) : undefined,
    requestId: requestId ? String(requestId) : undefined,
  };
}

function parseTextLogLine(line: string): GatewayLogEntry | null {
  const patterns = [
    /^(?<timestamp>\S+)\s+(?<clientId>\S+)\s+(?<method>\S+)\s+(?<path>\S+)\s+(?<statusCode>\d+)(?:\s+(?<clientVersion>\S+))?/,
    /\[(?<timestamp>[^\]]+)\]\s+"(?<method>\S+)\s+(?<path>\S+)\s+\S+"\s+(?<statusCode>\d+)\s+\S+\s+"(?<clientId>[^"]*)"(?:\s+"(?<userAgent>[^"]*)")?/,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match?.groups) {
      const g = match.groups;
      return {
        timestamp: g.timestamp || new Date().toISOString(),
        clientId: g.clientId || 'unknown',
        clientVersion: g.clientVersion,
        path: normalizePath(g.path),
        method: g.method.toUpperCase(),
        statusCode: parseInt(g.statusCode, 10) || 0,
        userAgent: g.userAgent,
      };
    }
  }

  return null;
}

function normalizePath(p: string): string {
  try {
    const url = new URL(p, 'http://localhost');
    return url.pathname;
  } catch {
    const queryIndex = p.indexOf('?');
    return queryIndex > -1 ? p.slice(0, queryIndex) : p;
  }
}

function sortLogs(logs: GatewayLogEntry[]): GatewayLogEntry[] {
  return [...logs].sort((a, b) => {
    const timeA = parseTimestamp(a.timestamp).getTime();
    const timeB = parseTimestamp(b.timestamp).getTime();
    return timeA - timeB;
  });
}

export function parseTimestamp(ts: string): Date {
  try {
    const date = new Date(ts);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch {}
  
  const ms = parseInt(ts, 10);
  if (!isNaN(ms)) {
    if (ts.length === 13) return new Date(ms);
    if (ts.length === 10) return new Date(ms * 1000);
  }
  
  return new Date();
}

export interface ClientVersionAggregation {
  clientId: string;
  versions: Record<string, {
    count: number;
    paths: Record<string, number>;
    methods: Record<string, number>;
    firstSeen: Date;
    lastSeen: Date;
  }>;
  totalCount: number;
}

export function aggregateByClientVersion(logs: GatewayLogEntry[]): Map<string, ClientVersionAggregation> {
  const result = new Map<string, ClientVersionAggregation>();

  for (const log of logs) {
    let clientData = result.get(log.clientId);
    if (!clientData) {
      clientData = {
        clientId: log.clientId,
        versions: {},
        totalCount: 0,
      };
      result.set(log.clientId, clientData);
    }

    const version = log.clientVersion || 'unknown';
    if (!clientData.versions[version]) {
      clientData.versions[version] = {
        count: 0,
        paths: {},
        methods: {},
        firstSeen: parseTimestamp(log.timestamp),
        lastSeen: parseTimestamp(log.timestamp),
      };
    }

    const versionData = clientData.versions[version];
    versionData.count++;
    versionData.paths[log.path] = (versionData.paths[log.path] || 0) + 1;
    versionData.methods[log.method] = (versionData.methods[log.method] || 0) + 1;
    
    const logTime = parseTimestamp(log.timestamp);
    if (logTime < versionData.firstSeen) versionData.firstSeen = logTime;
    if (logTime > versionData.lastSeen) versionData.lastSeen = logTime;
    
    clientData.totalCount++;
  }

  return result;
}

export interface RouteUsage {
  path: string;
  method: string;
  count: number;
  clients: Record<string, {
    count: number;
    versions: string[];
    lastUsed: Date;
  }>;
}

export function aggregateRouteUsage(
  logs: GatewayLogEntry[],
  deprecatedPaths: Set<string>
): RouteUsage[] {
  const routeMap = new Map<string, RouteUsage>();

  for (const log of logs) {
    const key = `${log.method} ${log.path}`;
    
    let route = routeMap.get(key);
    if (!route) {
      route = {
        path: log.path,
        method: log.method,
        count: 0,
        clients: {},
      };
      routeMap.set(key, route);
    }

    route.count++;

    if (!route.clients[log.clientId]) {
      route.clients[log.clientId] = {
        count: 0,
        versions: [],
        lastUsed: parseTimestamp(log.timestamp),
      };
    }

    const clientData = route.clients[log.clientId];
    clientData.count++;
    if (log.clientVersion && !clientData.versions.includes(log.clientVersion)) {
      clientData.versions.push(log.clientVersion);
    }
    
    const logTime = parseTimestamp(log.timestamp);
    if (logTime > clientData.lastUsed) {
      clientData.lastUsed = logTime;
    }
  }

  return Array.from(routeMap.values())
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);
}
