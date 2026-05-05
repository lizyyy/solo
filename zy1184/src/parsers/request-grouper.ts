import { ApiLog, SqlQuery, RequestGroup, RequestGroupStats, RequestGroupFilter } from '../models';
import { generateId } from '../utils/id-generator';

export class RequestGrouper {
  private apiLogs: ApiLog[] = [];
  private sqlQueries: SqlQuery[] = [];

  addApiLogs(logs: ApiLog[]): void {
    this.apiLogs.push(...logs);
  }

  addSqlQueries(queries: SqlQuery[]): void {
    this.sqlQueries.push(...queries);
  }

  clear(): void {
    this.apiLogs = [];
    this.sqlQueries = [];
  }

  group(): RequestGroup[] {
    const requestMap = new Map<string, {
      apiLog?: ApiLog;
      queries: SqlQuery[];
    }>();

    for (const log of this.apiLogs) {
      const requestId = log.requestId || generateId();
      if (!requestMap.has(requestId)) {
        requestMap.set(requestId, { queries: [] });
      }
      requestMap.get(requestId)!.apiLog = log;
    }

    for (const query of this.sqlQueries) {
      const requestId = query.requestId || generateId();
      if (!requestMap.has(requestId)) {
        requestMap.set(requestId, { queries: [] });
      }
      requestMap.get(requestId)!.queries.push(query);
    }

    const groups: RequestGroup[] = [];

    for (const [requestId, data] of requestMap) {
      const queries = data.queries.sort((a, b) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );

      const allTimestamps = [
        data.apiLog?.timestamp,
        ...queries.map(q => q.timestamp),
      ].filter(Boolean) as Date[];

      const startTime = allTimestamps.length > 0 
        ? new Date(Math.min(...allTimestamps.map(t => t.getTime())))
        : new Date();

      const endTime = allTimestamps.length > 0
        ? new Date(Math.max(...allTimestamps.map(t => t.getTime())))
        : new Date();

      const queryByTable: Record<string, SqlQuery[]> = {};
      const queryByOperation: Record<string, SqlQuery[]> = {};

      for (const query of queries) {
        if (query.tableName) {
          if (!queryByTable[query.tableName]) {
            queryByTable[query.tableName] = [];
          }
          queryByTable[query.tableName].push(query);
        }

        if (!queryByOperation[query.operationType]) {
          queryByOperation[query.operationType] = [];
        }
        queryByOperation[query.operationType].push(query);
      }

      groups.push({
        requestId,
        apiLog: data.apiLog,
        sqlQueries: queries,
        startTime,
        endTime,
        totalDuration: endTime.getTime() - startTime.getTime(),
        totalQueryCount: queries.length,
        totalQueryDuration: queries.reduce((sum, q) => sum + q.duration, 0),
        queryByTable,
        queryByOperation,
        metadata: {},
      });
    }

    return groups.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  filter(groups: RequestGroup[], filter: RequestGroupFilter): RequestGroup[] {
    return groups.filter(group => {
      if (filter.requestId && group.requestId !== filter.requestId) {
        return false;
      }

      if (filter.path && group.apiLog?.path !== filter.path) {
        return false;
      }

      if (filter.method && group.apiLog?.method !== filter.method) {
        return false;
      }

      if (filter.statusCode !== undefined && group.apiLog?.statusCode !== filter.statusCode) {
        return false;
      }

      if (filter.minDuration !== undefined && group.totalDuration < filter.minDuration) {
        return false;
      }

      if (filter.maxDuration !== undefined && group.totalDuration > filter.maxDuration) {
        return false;
      }

      if (filter.minQueryCount !== undefined && group.totalQueryCount < filter.minQueryCount) {
        return false;
      }

      if (filter.maxQueryCount !== undefined && group.totalQueryCount > filter.maxQueryCount) {
        return false;
      }

      if (filter.startTime && group.endTime < filter.startTime) {
        return false;
      }

      if (filter.endTime && group.startTime > filter.endTime) {
        return false;
      }

      if (filter.tableName && !group.queryByTable[filter.tableName]) {
        return false;
      }

      return true;
    });
  }

  getStats(groups: RequestGroup[]): RequestGroupStats {
    if (groups.length === 0) {
      return {
        totalRequests: 0,
        totalQueries: 0,
        totalApiDuration: 0,
        totalQueryDuration: 0,
        avgQueriesPerRequest: 0,
        avgApiDuration: 0,
        avgQueryDuration: 0,
        slowestRequest: { requestId: '', duration: 0, queryCount: 0 },
        mostQueriesRequest: { requestId: '', queryCount: 0, duration: 0 },
        tablesAccessed: [],
      };
    }

    const totalQueries = groups.reduce((sum, g) => sum + g.totalQueryCount, 0);
    const totalApiDuration = groups.reduce((sum, g) => sum + (g.apiLog?.duration || 0), 0);
    const totalQueryDuration = groups.reduce((sum, g) => sum + g.totalQueryDuration, 0);

    const tablesAccessed = new Set<string>();
    for (const group of groups) {
      for (const table of Object.keys(group.queryByTable)) {
        tablesAccessed.add(table);
      }
    }

    let slowestRequest = groups[0];
    let mostQueriesRequest = groups[0];

    for (const group of groups) {
      if (group.totalDuration > slowestRequest.totalDuration) {
        slowestRequest = group;
      }
      if (group.totalQueryCount > mostQueriesRequest.totalQueryCount) {
        mostQueriesRequest = group;
      }
    }

    return {
      totalRequests: groups.length,
      totalQueries,
      totalApiDuration,
      totalQueryDuration,
      avgQueriesPerRequest: totalQueries / groups.length,
      avgApiDuration: totalApiDuration / groups.length,
      avgQueryDuration: totalQueryDuration / totalQueries,
      slowestRequest: {
        requestId: slowestRequest.requestId,
        duration: slowestRequest.totalDuration,
        queryCount: slowestRequest.totalQueryCount,
      },
      mostQueriesRequest: {
        requestId: mostQueriesRequest.requestId,
        queryCount: mostQueriesRequest.totalQueryCount,
        duration: mostQueriesRequest.totalDuration,
      },
      tablesAccessed: Array.from(tablesAccessed),
    };
  }
}

export function groupRequests(
  apiLogs: ApiLog[],
  sqlQueries: SqlQuery[]
): RequestGroup[] {
  const grouper = new RequestGrouper();
  grouper.addApiLogs(apiLogs);
  grouper.addSqlQueries(sqlQueries);
  return grouper.group();
}
