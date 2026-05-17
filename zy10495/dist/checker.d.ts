import { CheckReport, CLIOptions } from './types.js';
export declare function runCheck(options: CLIOptions): Promise<CheckReport>;
export declare function getExitCode(report: CheckReport, failOnError: boolean): number;
