export interface ParsedFile {
    filePath: string;
    content: string;
    data: unknown;
    lines: string[];
}
export interface ValueNode {
    path: string;
    value: string;
    line: number;
}
export declare function parseYamlFile(filePath: string): ParsedFile;
export declare function extractAllValues(data: unknown, prefix?: string): ValueNode[];
export declare function findYamlFiles(dir: string): string[];
export declare function flattenObject(obj: Record<string, unknown>, prefix?: string): Record<string, string>;
