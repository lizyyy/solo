export interface DictField {
    fieldName: string;
    type: string;
    enumValues: string[];
    description: string;
}
export interface DictSource {
    systemName: string;
    filePath: string;
    fields: Map<string, DictField>;
    errors: ParseError[];
}
export interface ParseError {
    filePath: string;
    lineNumber: number;
    rawContent: string;
    reason: string;
}
export type ConflictLevel = 'critical' | 'warning' | 'info';
export interface FieldConflict {
    fieldName: string;
    level: ConflictLevel;
    type: 'type_mismatch' | 'enum_mismatch' | 'description_mismatch' | 'missing_field';
    sources: {
        systemName: string;
        field?: DictField;
    }[];
    details: string;
}
export interface DiffResult {
    timestamp: string;
    sources: {
        systemName: string;
        filePath: string;
        fieldCount: number;
        errorCount: number;
    }[];
    conflicts: FieldConflict[];
    summary: {
        totalFields: number;
        commonFields: number;
        criticalConflicts: number;
        warningConflicts: number;
        infoConflicts: number;
        parseErrors: number;
    };
    parseErrors: ParseError[];
}
