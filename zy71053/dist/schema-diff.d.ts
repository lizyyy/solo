import { GraphQLSchema, GraphQLType } from 'graphql';
import { SchemaField, FieldTypeInfo, NullabilityDiff, SchemaDiffSummary } from './types';
export declare function parseSchema(schemaContent: string): GraphQLSchema;
export declare function loadSchema(filePath: string): GraphQLSchema;
export declare function extractFieldTypeInfo(fieldType: GraphQLType): FieldTypeInfo;
export declare function extractAllFields(schema: GraphQLSchema): SchemaField[];
export declare function extractTypeMap(schema: GraphQLSchema): Map<string, string[]>;
export declare function detectNestedNullDrift(oldFields: SchemaField[], newFields: SchemaField[], typeMap?: Map<string, string[]>): NullabilityDiff[];
export declare function compareSchemas(oldSchema: GraphQLSchema, newSchema: GraphQLSchema): {
    changes: NullabilityDiff[];
    summary: SchemaDiffSummary;
    oldFields: SchemaField[];
    newFields: SchemaField[];
    typeMap: Map<string, string[]>;
};
