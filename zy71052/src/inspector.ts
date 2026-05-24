import { v4 as uuidv4 } from 'uuid';
import { CLIOptions, InspectionResult, ClientUsage, DeprecatedRoute, GatewayLogEntry } from './types';
import { parseOpenAPI, matchPathToRoute } from './openapi-parser';
import { parseGatewayLogs, parseTimestamp } from './log-parser';
import { loadClients, loadOwners, createClientsMap, createOwnersMap, matchOwner } from './data-loader';
import { getInspectionTimestamp } from './timezone-utils';
import { calculateRiskLevel, sortByRiskLevel } from './risk-assessor';

export function runInspection(options: CLIOptions): InspectionResult {
  const openapiData = parseOpenAPI(options.openapi, options.deprecationDate);
  const logs = parseGatewayLogs(options.logs);
  const clients = loadClients(options.clients);
  const owners = loadOwners(options.owners);

  const clientsMap = createClientsMap(clients);
  const ownersMap = createOwnersMap(owners);

  const { clientUsages, unmatchedRoutes, unmatchedClients } = analyzeUsage(
    logs,
    openapiData.deprecatedRoutes,
    clientsMap,
    ownersMap,
    options.timezone
  );

  const totalDeprecatedRequests = clientUsages.reduce((sum, c) => sum + c.totalRequests, 0);
  const activeDeprecatedRoutes = new Set(
    clientUsages.flatMap(c => c.routes.map(r => `${r.method} ${r.path}`))
  ).size;

  const result: InspectionResult = {
    metadata: {
      inspectionDate: getInspectionTimestamp(options.timezone),
      openapiFile: options.openapi,
      logFile: options.logs,
      clientFile: options.clients,
      ownerFile: options.owners,
      timezone: options.timezone,
      reportId: uuidv4(),
    },
    summary: {
      totalDeprecatedRoutes: openapiData.deprecatedRoutes.length,
      activeDeprecatedRoutes,
      affectedClients: clientUsages.length,
      totalDeprecatedRequests,
      criticalRiskClients: clientUsages.filter(c => c.riskLevel === 'critical').length,
      highRiskClients: clientUsages.filter(c => c.riskLevel === 'high').length,
      mediumRiskClients: clientUsages.filter(c => c.riskLevel === 'medium').length,
      lowRiskClients: clientUsages.filter(c => c.riskLevel === 'low').length,
    },
    deprecatedRoutes: openapiData.deprecatedRoutes,
    clientUsages: sortByRiskLevel(clientUsages, c => c.riskLevel),
    unmatchedRoutes,
    unmatchedClients,
  };

  return result;
}

interface AnalysisResult {
  clientUsages: ClientUsage[];
  unmatchedRoutes: { path: string; method: string; count: number }[];
  unmatchedClients: string[];
}

function analyzeUsage(
  logs: GatewayLogEntry[],
  deprecatedRoutes: DeprecatedRoute[],
  clientsMap: Map<string, any>,
  ownersMap: Map<string, any>,
  timezone: string
): AnalysisResult {
  const clientUsageMap = new Map<string, ClientUsage>();
  const routeUsageMap = new Map<string, { count: number; clients: Set<string> }>();
  const unmatchedRouteMap = new Map<string, number>();
  const allClientIds = new Set<string>();

  for (const log of logs) {
    allClientIds.add(log.clientId);

    const match = matchPathToRoute(log.path, deprecatedRoutes);
    
    if (match) {
      const routeKey = `${log.method} ${log.path}`;
      
      if (!routeUsageMap.has(routeKey)) {
        routeUsageMap.set(routeKey, { count: 0, clients: new Set() });
      }
      routeUsageMap.get(routeKey)!.count++;
      routeUsageMap.get(routeKey)!.clients.add(log.clientId);

      if (!clientUsageMap.has(log.clientId)) {
        const clientInfo = clientsMap.get(log.clientId);
        const owner = clientInfo ? matchOwner(clientInfo.owner, ownersMap) : undefined;
        
        clientUsageMap.set(log.clientId, {
          clientId: log.clientId,
          clientName: clientInfo?.name || log.clientId,
          versions: {},
          routes: [],
          totalRequests: 0,
          owner,
          riskLevel: 'none',
        });
      }

      const usage = clientUsageMap.get(log.clientId)!;
      usage.totalRequests++;

      const version = log.clientVersion || 'unknown';
      if (!usage.versions[version]) {
        usage.versions[version] = { count: 0, lastUsed: log.timestamp };
      }
      usage.versions[version].count++;
      
      const logTime = parseTimestamp(log.timestamp);
      const lastUsedTime = parseTimestamp(usage.versions[version].lastUsed);
      if (logTime > lastUsedTime) {
        usage.versions[version].lastUsed = log.timestamp;
      }

      const routeIndex = usage.routes.findIndex(
        r => r.path === match.route.path && r.method === match.route.method
      );
      
      if (routeIndex === -1) {
        usage.routes.push({
          path: match.route.path,
          method: match.route.method,
          count: 1,
          lastUsed: log.timestamp,
        });
      } else {
        usage.routes[routeIndex].count++;
        const routeLastUsed = parseTimestamp(usage.routes[routeIndex].lastUsed);
        if (logTime > routeLastUsed) {
          usage.routes[routeIndex].lastUsed = log.timestamp;
        }
      }
    } else {
      const unmatchedKey = `${log.method} ${log.path}`;
      unmatchedRouteMap.set(unmatchedKey, (unmatchedRouteMap.get(unmatchedKey) || 0) + 1);
    }
  }

  const clientUsages = Array.from(clientUsageMap.values());
  
  for (const usage of clientUsages) {
    const clientInfo = clientsMap.get(usage.clientId);
    const usedRoutes = deprecatedRoutes.filter(r =>
      usage.routes.some(ur => ur.path === r.path && ur.method === r.method)
    );
    
    const risk = calculateRiskLevel(
      usage,
      usedRoutes,
      timezone,
      clientInfo?.isInternal || false
    );
    usage.riskLevel = risk.level;
  }

  const unmatchedRoutes = Array.from(unmatchedRouteMap.entries())
    .map(([key, count]) => {
      const [method, ...pathParts] = key.split(' ');
      return {
        path: pathParts.join(' '),
        method,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const unmatchedClients = Array.from(allClientIds)
    .filter(id => !clientsMap.has(id))
    .sort();

  return { clientUsages, unmatchedRoutes, unmatchedClients };
}
