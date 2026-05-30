import type { CleaningSession, RawTrack } from './models.js';
import type { ParseResult } from './parser.js';
declare function generateTrackId(track: RawTrack, index: number): string;
declare function generateSessionId(): string;
export declare function cleanLibrary(parseResult: ParseResult, basePath: string, inputFiles: string[]): CleaningSession;
export { generateTrackId, generateSessionId };
