import { SqlQuery, SqlQueryParseOptions } from '../models';
export declare class SqlLogParser {
    private options;
    constructor(options?: SqlQueryParseOptions);
    parse(content: string): SqlQuery[];
    private parseJsonFormat;
    private parseJsonItem;
    private parsePlainFormat;
    private parseMySqlFormat;
    private parsePostgreSqlFormat;
    private isQueryStart;
    private parseQueryHeader;
    private buildQuery;
}
export declare function parseSqlLog(content: string, options?: SqlQueryParseOptions): SqlQuery[];
//# sourceMappingURL=sql-log-parser.d.ts.map