"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInspection = runInspection;
const uuid_1 = require("uuid");
const openapi_parser_1 = require("./openapi-parser");
const log_parser_1 = require("./log-parser");
const data_loader_1 = require("./data-loader");
const timezone_utils_1 = require("./timezone-utils");
const risk_assessor_1 = require("./risk-assessor");
function runInspection(options) {
    const openapiData = (0, openapi_parser_1.parseOpenAPI)(options.openapi, options.deprecationDate);
    const logs = (0, log_parser_1.parseGatewayLogs)(options.logs);
    const clients = (0, data_loader_1.loadClients)(options.clients);
    const owners = (0, data_loader_1.loadOwners)(options.owners);
    const clientsMap = (0, data_loader_1.createClientsMap)(clients);
    const ownersMap = (0, data_loader_1.createOwnersMap)(owners);
    const { clientUsages, unmatchedRoutes, unmatchedClients } = analyzeUsage(logs, openapiData.deprecatedRoutes, clientsMap, ownersMap, options.timezone);
    const totalDeprecatedRequests = clientUsages.reduce((sum, c) => sum + c.totalRequests, 0);
    const activeDeprecatedRoutes = new Set(clientUsages.flatMap(c => c.routes.map(r => `${r.method} ${r.path}`))).size;
    const result = {
        metadata: {
            inspectionDate: (0, timezone_utils_1.getInspectionTimestamp)(options.timezone),
            openapiFile: options.openapi,
            logFile: options.logs,
            clientFile: options.clients,
            ownerFile: options.owners,
            timezone: options.timezone,
            reportId: (0, uuid_1.v4)(),
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
        clientUsages: (0, risk_assessor_1.sortByRiskLevel)(clientUsages, c => c.riskLevel),
        unmatchedRoutes,
        unmatchedClients,
    };
    return result;
}
function analyzeUsage(logs, deprecatedRoutes, clientsMap, ownersMap, timezone) {
    const clientUsageMap = new Map();
    const routeUsageMap = new Map();
    const unmatchedRouteMap = new Map();
    const allClientIds = new Set();
    for (const log of logs) {
        allClientIds.add(log.clientId);
        const match = (0, openapi_parser_1.matchPathToRoute)(log.path, deprecatedRoutes);
        if (match) {
            const routeKey = `${log.method} ${log.path}`;
            if (!routeUsageMap.has(routeKey)) {
                routeUsageMap.set(routeKey, { count: 0, clients: new Set() });
            }
            routeUsageMap.get(routeKey).count++;
            routeUsageMap.get(routeKey).clients.add(log.clientId);
            if (!clientUsageMap.has(log.clientId)) {
                const clientInfo = clientsMap.get(log.clientId);
                const owner = clientInfo ? (0, data_loader_1.matchOwner)(clientInfo.owner, ownersMap) : undefined;
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
            const usage = clientUsageMap.get(log.clientId);
            usage.totalRequests++;
            const version = log.clientVersion || 'unknown';
            if (!usage.versions[version]) {
                usage.versions[version] = { count: 0, lastUsed: log.timestamp };
            }
            usage.versions[version].count++;
            const logTime = (0, log_parser_1.parseTimestamp)(log.timestamp);
            const lastUsedTime = (0, log_parser_1.parseTimestamp)(usage.versions[version].lastUsed);
            if (logTime > lastUsedTime) {
                usage.versions[version].lastUsed = log.timestamp;
            }
            const routeIndex = usage.routes.findIndex(r => r.path === match.route.path && r.method === match.route.method);
            if (routeIndex === -1) {
                usage.routes.push({
                    path: match.route.path,
                    method: match.route.method,
                    count: 1,
                    lastUsed: log.timestamp,
                });
            }
            else {
                usage.routes[routeIndex].count++;
                const routeLastUsed = (0, log_parser_1.parseTimestamp)(usage.routes[routeIndex].lastUsed);
                if (logTime > routeLastUsed) {
                    usage.routes[routeIndex].lastUsed = log.timestamp;
                }
            }
        }
        else {
            const unmatchedKey = `${log.method} ${log.path}`;
            unmatchedRouteMap.set(unmatchedKey, (unmatchedRouteMap.get(unmatchedKey) || 0) + 1);
        }
    }
    const clientUsages = Array.from(clientUsageMap.values());
    for (const usage of clientUsages) {
        const clientInfo = clientsMap.get(usage.clientId);
        const usedRoutes = deprecatedRoutes.filter(r => usage.routes.some(ur => ur.path === r.path && ur.method === r.method));
        const risk = (0, risk_assessor_1.calculateRiskLevel)(usage, usedRoutes, timezone, clientInfo?.isInternal || false);
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
//# sourceMappingURL=inspector.js.map