import { FeatureFlag, CodeReference, DeadBranch, BadSample } from '../types';
export declare class CodeScanner {
    private badSamples;
    private flagPatterns;
    scanDirectory(sourceDir: string, flags: FeatureFlag[], filePatterns: string[], excludePatterns: string[]): Promise<{
        references: CodeReference[];
        deadBranches: DeadBranch[];
        badSamples: BadSample[];
        filesScanned: number;
    }>;
    private findFiles;
    private scanFile;
    private extractContext;
    private detectContextType;
    private analyzeDeadBranch;
    private isNegated;
}
