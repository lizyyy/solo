import { Report } from '../types';
export declare const listReportsCommand: () => void;
export declare const generateReportCommand: (options: {
    type: Report["type"];
    name: string;
    checkResultId?: string;
    replayTaskId?: string;
    cacheRecordId?: string;
}) => void;
export declare const viewReportCommand: (reportId: string) => void;
//# sourceMappingURL=report.d.ts.map