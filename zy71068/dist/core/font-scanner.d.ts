import { FontFile } from '../types.js';
export declare class FontScanner {
    private projectDir;
    private customExtensions;
    constructor(projectDir: string, customExtensions?: string[]);
    scan(verbose?: boolean): Promise<FontFile[]>;
    private parseFontFile;
    private extractFamilyName;
    private parseFontAttributes;
    getFontFilesByFamily(fontFiles: FontFile[]): Map<string, FontFile[]>;
    detectVersionConflicts(fontFiles: FontFile[]): Map<string, FontFile[]>;
}
