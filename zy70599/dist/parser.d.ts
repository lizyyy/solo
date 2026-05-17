import { DictSource, ParseError } from './types';
export declare class DictionaryParser {
    private parseErrors;
    parse(filePath: string, systemName: string): DictSource;
    private parseCsv;
    private parseJson;
    private findColumn;
    private addParseError;
    getErrors(): ParseError[];
}
