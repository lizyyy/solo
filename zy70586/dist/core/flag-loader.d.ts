import { FeatureFlag, BadSample, MergeStrategy } from '../types';
export declare class FlagLoader {
    private badSamples;
    loadFlags(flagsFile?: string, inlineFlags?: FeatureFlag[], defaultStrategy?: MergeStrategy): Promise<{
        flags: FeatureFlag[];
        badSamples: BadSample[];
    }>;
    private loadFlagsFromFile;
    private validateAndNormalizeFlag;
    private parseBoolean;
    private mergeFlags;
}
