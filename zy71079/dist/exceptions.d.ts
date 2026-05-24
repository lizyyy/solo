import { ExceptionRule } from './types';
export declare class ExceptionLoader {
    private rules;
    private filePath;
    constructor(filePath: string);
    load(): Promise<ExceptionRule[]>;
    private validateRule;
    getMatchingRule(filePath: string): ExceptionRule | undefined;
    getExpiredRules(): ExceptionRule[];
    getActiveRules(): ExceptionRule[];
    getAllRules(): ExceptionRule[];
    isPathExcluded(filePath: string): boolean;
}
export declare function loadExceptions(filePath: string): Promise<ExceptionLoader>;
//# sourceMappingURL=exceptions.d.ts.map