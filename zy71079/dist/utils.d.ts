export declare function generateId(...parts: string[]): string;
export declare function normalizeFilePath(filePath: string): string;
export declare function isExpired(dateStr: string): boolean;
export declare function formatDate(date: Date | string): string;
export declare function formatDuration(ms: number): string;
export declare function matchesGlobPattern(filePath: string, pattern: string): boolean;
export declare function getFileExtension(filePath: string): string;
export declare function isJsFile(filePath: string): boolean;
export declare function isSourcemapFile(filePath: string): boolean;
export declare function ensureTrailingSlash(str: string): string;
export declare function joinPublicPath(base: string, ...parts: string[]): string;
export declare function truncateString(str: string, maxLength?: number): string;
export declare function pluralize(count: number, singular: string, plural?: string): string;
//# sourceMappingURL=utils.d.ts.map