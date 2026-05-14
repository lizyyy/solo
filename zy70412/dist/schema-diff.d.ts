import { SchemaDiff } from './types';
export declare class SchemaDiffer {
    compare(schema1: any, schema2: any, path?: string): SchemaDiff[];
    private isTypeChange;
    private getJsonSchemaType;
    hasCriticalDiffs(diffs: SchemaDiff[]): boolean;
    summarizeDiffs(diffs: SchemaDiff[]): {
        critical: SchemaDiff[];
        minor: SchemaDiff[];
    };
}
export declare function compareSchemas(schema1: any, schema2: any): SchemaDiff[];
