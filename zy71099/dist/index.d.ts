import { parseCassette } from './parsers/cassette-parser';
import { DiffEngine } from './diff/diff-engine';
import { getDefaultConfig, loadConfigFromFile } from './masking/masking-engine';
import { DiffConfig, DiffResult } from './types';
export interface CompareOptions {
    expectedFile: string;
    actualFile: string;
    config?: DiffConfig;
    configFile?: string;
    outputDir?: string;
    ignoreOrder?: boolean;
    ignoreFields?: string[];
    format?: 'text' | 'json' | 'markdown' | 'all';
    verbose?: boolean;
    quiet?: boolean;
}
export declare function compareCassettes(options: CompareOptions): Promise<{
    result: DiffResult;
    exitCode: number;
}>;
export { parseCassette };
export { DiffEngine };
export { getDefaultConfig, loadConfigFromFile };
export * from './types';
