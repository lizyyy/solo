import { GraphQLSchema } from 'graphql';
import { QuerySample, FieldUsage, AnalysisResult, AnalysisError } from './types';
import { extractFieldsFromQuery } from './query-scanner';
import { getAllSchemaFields } from './schema-parser';

interface FieldUsageAccumulator {
  [fullPath: string]: {
    count: number;
    clients: Record<string, number>;
  };
}

export function analyzeQueries(
  queries: QuerySample[],
  schema: GraphQLSchema,
  initialErrors: AnalysisError[] = []
): AnalysisResult {
  const fieldUsageAccumulator: FieldUsageAccumulator = {};
  const errors: AnalysisError[] = [...initialErrors];
  const clientStats: Record<string, number> = {};
  let successfulQueries = 0;

  const schemaFields = getAllSchemaFields(schema);

  for (const querySample of queries) {
    try {
      const { fields, clientTag } = extractFieldsFromQuery(
        querySample.query,
        querySample.clientTag
      );

      clientStats[clientTag] = (clientStats[clientTag] || 0) + 1;

      for (const fullPath of fields) {
        if (!fieldUsageAccumulator[fullPath]) {
          fieldUsageAccumulator[fullPath] = {
            count: 0,
            clients: {}
          };
        }
        fieldUsageAccumulator[fullPath].count++;
        fieldUsageAccumulator[fullPath].clients[clientTag] =
          (fieldUsageAccumulator[fullPath].clients[clientTag] || 0) + 1;
      }

      successfulQueries++;
    } catch (error) {
      errors.push({
        message: `解析查询失败: ${(error as Error).message}`,
        source: querySample.source,
        lineNumber: querySample.lineNumber,
        query: querySample.query
      });
    }
  }

  const fieldUsage: FieldUsage[] = Object.entries(fieldUsageAccumulator)
    .map(([fullPath, data]) => {
      const parts = fullPath.split('.');
      const fieldName = parts.pop() || '';
      const typeName = parts.join('.');

      return {
        fieldName,
        typeName,
        fullPath,
        count: data.count,
        clients: data.clients
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    fieldUsage,
    totalQueries: queries.length,
    successfulQueries,
    failedQueries: errors.length,
    errors,
    clientStats
  };
}

export function getUnusedFields(
  result: AnalysisResult,
  schema: GraphQLSchema
): string[] {
  const schemaFields = getAllSchemaFields(schema);
  const usedFields = new Set(result.fieldUsage.map(f => f.fullPath));
  const unusedFields: string[] = [];

  for (const field of schemaFields) {
    if (!usedFields.has(field)) {
      unusedFields.push(field);
    }
  }

  return unusedFields.sort();
}
