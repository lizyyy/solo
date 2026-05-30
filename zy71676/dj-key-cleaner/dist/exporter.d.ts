import type { CleaningSession } from './models.js';
export declare function exportCSV(session: CleaningSession, outputPath: string): void;
export declare function exportJSON(session: CleaningSession, outputPath: string): void;
export declare function exportReport(session: CleaningSession, outputPath: string): void;
export declare function exportAll(session: CleaningSession, outputDir: string): string[];
