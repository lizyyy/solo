import { SourceType, StandardizedRecord } from '../types';
import { ParsedRow } from '../parsers';
export interface FieldMapping {
    sourceField: string;
    targetField: keyof StandardizedRecord;
    transform?: (value: string) => any;
    required?: boolean;
}
export interface StandardizationResult {
    success: boolean;
    data?: Partial<StandardizedRecord>;
    errors: {
        field: string;
        code: string;
        message: string;
    }[];
    confidence: number;
}
export declare function standardizeRow(row: ParsedRow, sourceType: SourceType): StandardizationResult;
export declare function validateStandardizedData(data: Partial<StandardizedRecord>, sourceType: SourceType): {
    field: string;
    code: string;
    message: string;
    severity: 'error' | 'warning';
}[];
