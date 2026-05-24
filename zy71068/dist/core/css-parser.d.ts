import { FontReference } from '../types.js';
export declare class CssParser {
    private projectDir;
    constructor(projectDir: string);
    parseAll(includeRemote?: boolean, verbose?: boolean): Promise<FontReference[]>;
    private getSourceType;
    private parseStylesheet;
    private parseHtml;
    private extractFontFace;
    private parseFontFaceRule;
    private parseFontFaceText;
    private extractFontFamily;
    private extractSrc;
    private isRemoteUrl;
    getRemoteReferences(refs: FontReference[]): FontReference[];
    matchReferencesWithFiles(references: FontReference[], fontFiles: {
        familyName: string;
        fileName: string;
    }[]): {
        matched: FontReference[];
        unmatched: FontReference[];
    };
}
