import { BounceRecord, AppConfig } from '../types';
export declare class BounceParser {
    private config;
    constructor(config?: Partial<AppConfig>);
    parseEmailFile(filePath: string): Promise<BounceRecord>;
    parseEmailContent(content: string, sourceId?: string): Promise<BounceRecord>;
    parseBounceData(data: {
        recipient: string;
        smtpCode?: string;
        enhancedCode?: string;
        provider?: string;
        batchId?: string;
        rawMessage?: string;
        subject?: string;
        timestamp?: number;
    }): BounceRecord;
    private extractRecipient;
    private extractSmtpCode;
    private extractEnhancedCode;
    private detectProvider;
    private extractBatchId;
    private classifyBounce;
    private matchProviderPatterns;
    private matchGeneralPatterns;
    private getReasonForCategory;
    private generateRetrySuggestion;
    parseDirectory(dirPath: string): Promise<BounceRecord[]>;
}
