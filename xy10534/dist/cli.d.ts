export declare class CLI {
    private storage;
    constructor(dataDir?: string);
    init(releasePlanId: string, releaseName: string, options: {
        sample?: boolean;
        successSample?: boolean;
    }): void;
    import(filePath: string, options: {
        type?: string;
    }): void;
    check(options: {
        operator?: string;
    }): void;
    detail(options: {
        service?: string;
        history?: boolean;
        checkHistoryId?: string;
    }): void;
    report(options: {
        output?: string;
        format?: string;
    }): void;
    private printCheckSummary;
    private printCheckResults;
    private printOverview;
    private printServiceDetail;
    private printCheckHistory;
    private printSpecificHistory;
    private generateTextReport;
    private generateJsonReport;
}
//# sourceMappingURL=cli.d.ts.map