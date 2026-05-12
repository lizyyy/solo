import { ScanResult, FilterOptions } from './types';
import { ConfigLoader } from './config-loader';
import { OpenAPIParser } from './openapi-parser';
export declare class ScanEngine {
    private configLoader;
    private parser;
    constructor(baseDir?: string);
    scan(configPath: string, filterOptions?: FilterOptions): ScanResult;
    getConfigLoader(): ConfigLoader;
    getParser(): OpenAPIParser;
}
//# sourceMappingURL=scan-engine.d.ts.map