import { Cassette } from '../types';
export interface ParseError {
    message: string;
    line?: number;
    column?: number;
    code: number;
}
export declare class CassetteParser {
    private filePath;
    private rawContent;
    constructor(filePath: string);
    parse(): Promise<Cassette>;
    private validateFileExists;
    private readFile;
    private detectFormat;
    private parseYaml;
    private parseJson;
    private getLineOffsets;
    private findLineNumber;
    private normalizeCassette;
    private normalizeInteraction;
    private normalizeRequest;
    private normalizeResponse;
    private normalizeHeaders;
    private normalizeBody;
    private looksLikeJson;
    private extractQueryParams;
    private stripQueryString;
    private generateInteractionId;
    private estimateInteractionLine;
    private createParseError;
}
export declare function parseCassette(filePath: string): Promise<Cassette>;
