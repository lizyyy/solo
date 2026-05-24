export type NullabilityChangeType = 'NON_NULL_TO_NULLABLE' | 'LIST_INNER_NON_NULL_TO_NULLABLE' | 'LIST_WRAPPER_NON_NULL_TO_NULLABLE' | 'NESTED_FIELD_NULL_DRIFT' | 'TYPE_REPLACED_WITH_NULLABLE' | 'FIELD_REMOVED';
export interface FieldTypeInfo {
    isNonNull: boolean;
    isList: boolean;
    innerType: string;
    fullType: string;
    rawType: string;
    listInnerNonNull: boolean;
}
export interface SchemaField {
    typeName: string;
    fieldName: string;
    fieldPath: string;
    typeInfo: FieldTypeInfo;
    description?: string;
}
export interface NullabilityDiff {
    fieldPath: string;
    typeName: string;
    fieldName: string;
    changeType: NullabilityChangeType;
    oldType: FieldTypeInfo;
    newType: FieldTypeInfo;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    ruleExplanation: string;
}
export interface QueryDocument {
    filePath: string;
    operations: QueryOperation[];
}
export interface QueryOperation {
    name: string;
    type: 'query' | 'mutation' | 'subscription';
    fields: QueryField[];
}
export interface QueryField {
    fieldName: string;
    fieldPath: string;
    alias?: string;
    subFields: QueryField[];
}
export interface AffectedQuery {
    documentPath: string;
    operationName: string;
    operationType: string;
    affectedFields: AffectedField[];
}
export interface AffectedField {
    queryPath: string;
    schemaPath: string;
    changeType: NullabilityChangeType;
    fallbackRecommendation: string;
}
export interface ClientVersion {
    version: string;
    releaseDate?: string;
    minSchemaVersion?: string;
}
export interface ChangeNote {
    fieldPath: string;
    reason: string;
    author?: string;
    date?: string;
    ticket?: string;
}
export interface DriftReportInput {
    oldSchemaPath: string;
    newSchemaPath: string;
    queryPaths: string[];
    fieldPaths?: string[];
    clientVersion?: ClientVersion;
    changeNotes?: ChangeNote[];
}
export interface DriftReport {
    metadata: ReportMetadata;
    schemaDiff: SchemaDiffSummary;
    nullabilityChanges: NullabilityDiff[];
    affectedQueries: AffectedQuery[];
    failurePaths: FailurePath[];
    statistics: ReportStatistics;
    exitCode: ExitCode;
}
export interface ReportMetadata {
    generatedAt: string;
    oldSchemaHash: string;
    newSchemaHash: string;
    clientVersion?: string;
    schemaVersionRange?: {
        from?: string;
        to?: string;
    };
}
export interface SchemaDiffSummary {
    totalFieldsChecked: number;
    fieldsAdded: number;
    fieldsRemoved: number;
    typesAdded: number;
    typesRemoved: number;
    nullabilityChangesCount: number;
}
export interface FailurePath {
    path: string;
    changeType: NullabilityChangeType;
    queryOperations: string[];
    rootCause: string;
    recommendedAction: string;
}
export interface ReportStatistics {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    queriesScanned: number;
    queriesAffected: number;
    fieldsScanned: number;
}
export declare enum ExitCode {
    SUCCESS = 0,
    CRITICAL_ISSUES = 1,
    HIGH_ISSUES = 2,
    INPUT_ERROR = 3,
    SCHEMA_PARSE_ERROR = 4,
    QUERY_PARSE_ERROR = 5,
    MISSING_HISTORY = 6,
    SELF_TEST_FAILED = 7
}
export interface CLIOptions {
    oldSchema: string;
    newSchema: string;
    queries?: string[];
    outputDir: string;
    format: ('terminal' | 'json' | 'markdown' | 'all')[];
    failOn: 'critical' | 'high' | 'medium' | 'any' | 'none';
    clientVersion?: string;
    fieldFilter?: string[];
    verbose: boolean;
    config?: string;
}
export interface ConfigFile {
    outputDir?: string;
    failOn?: 'critical' | 'high' | 'medium' | 'any' | 'none';
    ignoredFields?: string[];
    queryGlobs?: string[];
    schemaVersion?: string;
}
