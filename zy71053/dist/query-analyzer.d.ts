import { QueryDocument, NullabilityDiff, AffectedQuery, SchemaField } from './types';
export declare function parseQueryDocument(filePath: string, content: string): QueryDocument;
export declare function loadQueryDocuments(filePaths: string[]): QueryDocument[];
export declare function analyzeQueryImpact(documents: QueryDocument[], nullabilityChanges: NullabilityDiff[], schemaFields: SchemaField[], schemaTypeMap?: Map<string, string[]>): AffectedQuery[];
export declare function collectAllQueryPaths(documents: QueryDocument[]): string[];
