import { SourcemapReference } from './types';
export declare function findLineAndColumn(content: string, charIndex: number): {
    line: number;
    column: number;
};
export declare function parseSourcemapReferences(content: string): SourcemapReference[];
export declare function parseFile(filePath: string): Promise<SourcemapReference[]>;
export declare function resolveSourcemapPath(jsFilePath: string, mapPath: string): string;
export declare function isValidSourcemap(content: string): boolean;
export declare function checkSourcemapValidity(filePath: string): Promise<boolean>;
//# sourceMappingURL=parser.d.ts.map