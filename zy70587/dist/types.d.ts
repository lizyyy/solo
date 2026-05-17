export interface SourceLocation {
    line: number;
    column: number;
}
export interface AnchorInfo {
    name: string;
    location: SourceLocation;
    value: any;
}
export interface MergeSource {
    anchorName: string;
    location: SourceLocation;
    keys: string[];
}
export interface ValueOverride {
    path: string;
    key: string;
    oldValue: any;
    newValue: any;
    sourceAnchor?: string;
    overrideLocation: SourceLocation;
    originalLocation?: SourceLocation;
}
export interface YamlError {
    message: string;
    location: SourceLocation;
    severity: 'error' | 'warning';
    context?: string;
}
export interface ExpandResult {
    success: boolean;
    exitCode: number;
    inputFile: string;
    outputBase: string;
    timestamp: string;
    originalYaml: string;
    expandedYaml: string;
    anchors: AnchorInfo[];
    mergeNodes: {
        path: string;
        location: SourceLocation;
        sources: MergeSource[];
    }[];
    overrides: ValueOverride[];
    errors: YamlError[];
    warnings: YamlError[];
    statistics: {
        totalAnchors: number;
        totalMerges: number;
        totalOverrides: number;
        totalErrors: number;
        totalWarnings: number;
    };
}
export interface ExpandOptions {
    inputFile: string;
    outputDir?: string;
    outputBase?: string;
    jsonOutput?: boolean;
    markdownOutput?: boolean;
    prettyPrint?: boolean;
    preserveTracing?: boolean;
}
