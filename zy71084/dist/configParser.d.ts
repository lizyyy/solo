import { TargetConfig } from './types';
export declare class ConfigParser {
    static parseTargetsFromYaml(filePath: string): TargetConfig[];
    static parseTargetsFromJson(filePath: string): TargetConfig[];
    private static buildLineMap;
    private static parseTargetsData;
    private static parseTargetItem;
    static parseTargetsFromFile(filePath: string): TargetConfig[];
    static parseSimpleTarget(bundleId: string, name?: string): TargetConfig;
}
