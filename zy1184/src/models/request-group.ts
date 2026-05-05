import { ApiLog } from './api-log';
import { SqlQuery } from './sql-query';

export interface RequestGroup {
  requestId: string;
  apiLog?: ApiLog;
  sqlQueries: SqlQuery[];
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  totalQueryCount: number;
  totalQueryDuration: number;
  queryByTable: Record<string, SqlQuery[]>;
  queryByOperation: Record<string, SqlQuery[]>;
  metadata: Record<string, any>;
}

export interface RequestGroupStats {
  totalRequests: number;
  totalQueries: number;
  totalApiDuration: number;
  totalQueryDuration: number;
  avgQueriesPerRequest: number;
  avgApiDuration: number;
  avgQueryDuration: number;
  slowestRequest: {
    requestId: string;
    duration: number;
    queryCount: number;
  };
  mostQueriesRequest: {
    requestId: string;
    queryCount: number;
    duration: number;
  };
  tablesAccessed: string[];
}

export interface RequestGroupFilter {
  requestId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  minDuration?: number;
  maxDuration?: number;
  minQueryCount?: number;
  maxQueryCount?: number;
  startTime?: Date;
  endTime?: Date;
  tableName?: string;
}
