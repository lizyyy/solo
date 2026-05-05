import { ApiLog, SqlQuery, RequestGroup, RequestGroupStats, RequestGroupFilter } from '../models';
export declare class RequestGrouper {
    private apiLogs;
    private sqlQueries;
    addApiLogs(logs: ApiLog[]): void;
    addSqlQueries(queries: SqlQuery[]): void;
    clear(): void;
    group(): RequestGroup[];
    filter(groups: RequestGroup[], filter: RequestGroupFilter): RequestGroup[];
    getStats(groups: RequestGroup[]): RequestGroupStats;
}
export declare function groupRequests(apiLogs: ApiLog[], sqlQueries: SqlQuery[]): RequestGroup[];
//# sourceMappingURL=request-grouper.d.ts.map