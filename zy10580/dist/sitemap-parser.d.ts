import { SitemapEntry, ParseError } from './types';
export declare class SitemapParser {
    private parser;
    constructor();
    parse(filePath: string): Promise<{
        entries: SitemapEntry[];
        errors: ParseError[];
    }>;
    parseDirectory(dirPath: string): Promise<{
        entries: SitemapEntry[];
        errors: ParseError[];
    }>;
    private findSitemapFiles;
    private parseContent;
    private findLineNumber;
}
