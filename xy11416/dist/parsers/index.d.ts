import { SourceType } from '../types';
export interface ParsedRow {
    rawLineNumber: number;
    rawContent: string;
    fields: Record<string, string>;
}
export declare abstract class BaseParser {
    abstract parse(filePath: string): Promise<ParsedRow[]>;
    protected detectSourceType(filePath: string): SourceType;
}
export declare class CsvParser extends BaseParser {
    parse(filePath: string): Promise<ParsedRow[]>;
}
export declare class ExcelParser extends BaseParser {
    parse(filePath: string): Promise<ParsedRow[]>;
}
export declare class TextParser extends BaseParser {
    parse(filePath: string): Promise<ParsedRow[]>;
}
export declare function getParser(filePath: string): BaseParser;
