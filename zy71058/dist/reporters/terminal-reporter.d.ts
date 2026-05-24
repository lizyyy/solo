import { ScanResult } from '../types';
export declare function printTerminalSummary(result: ScanResult, verbose?: boolean): void;
export declare function getExitCode(result: ScanResult, failOnSeverity: string[]): number;
