import { ImportStatement, DirtyLine } from './types';
export declare class ImportParser {
    parseFile(filePath: string): {
        imports: ImportStatement[];
        dirtyLines: DirtyLine[];
    };
    parseContent(content: string, sourceFile?: string): {
        imports: ImportStatement[];
        dirtyLines: DirtyLine[];
    };
    private isBlankOrComment;
    private updateMultilineCommentState;
    private parseImportLine;
    private extractImportPath;
    parseImportList(content: string): {
        imports: string[];
        dirtyLines: DirtyLine[];
    };
    private isValidImportPath;
}
