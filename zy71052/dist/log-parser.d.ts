import { GatewayLogEntry } from './types';
export declare function parseGatewayLogs(filePath: string): GatewayLogEntry[];
export declare function parseTimestamp(ts: string): Date;
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
export declare function aggregateByClientVersion(logs: GatewayLogEntry[]): Map<string, ClientVersionAggregation>;
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
export declare function aggregateRouteUsage(logs: GatewayLogEntry[], deprecatedPaths: Set<string>): RouteUsage[];
