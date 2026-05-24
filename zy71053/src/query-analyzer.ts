import { parse, DocumentNode, OperationDefinitionNode, SelectionSetNode, FieldNode, OperationTypeNode } from 'graphql';
import { QueryDocument, QueryOperation, QueryField, NullabilityDiff, AffectedQuery, AffectedField, SchemaField } from './types';
import { readFile } from './utils';

export function parseQueryDocument(filePath: string, content: string): QueryDocument {
  const ast = parse(content);
  const operations: QueryOperation[] = [];

  for (const definition of ast.definitions) {
    if (definition.kind === 'OperationDefinition') {
      const op = parseOperation(definition);
      if (op) {
        operations.push(op);
      }
    }
  }

  return {
    filePath,
    operations,
  };
}

function parseOperation(opDef: OperationDefinitionNode): QueryOperation | null {
  const name = opDef.name?.value || 'Anonymous';
  const type = mapOperationType(opDef.operation);

  if (!opDef.selectionSet) {
    return null;
  }

  const fields = parseSelectionSet(opDef.selectionSet, [], type);

  return {
    name,
    type,
    fields,
  };
}

function mapOperationType(op: OperationTypeNode): 'query' | 'mutation' | 'subscription' {
  switch (op) {
    case 'query':
      return 'query';
    case 'mutation':
      return 'mutation';
    case 'subscription':
      return 'subscription';
    default:
      return 'query';
  }
}

function parseSelectionSet(
  selectionSet: SelectionSetNode,
  pathStack: string[],
  operationType: 'query' | 'mutation' | 'subscription'
): QueryField[] {
  const fields: QueryField[] = [];

  for (const selection of selectionSet.selections) {
    if (selection.kind === 'Field') {
      const field = parseField(selection, pathStack, operationType);
      if (field) {
        fields.push(field);
      }
    }
  }

  return fields;
}

function parseField(
  fieldNode: FieldNode,
  pathStack: string[],
  operationType: 'query' | 'mutation' | 'subscription'
): QueryField | null {
  const fieldName = fieldNode.name.value;
  const alias = fieldNode.alias?.value;
  const displayName = alias || fieldName;
  const fieldPath = [...pathStack, displayName].join('.');

  let subFields: QueryField[] = [];
  if (fieldNode.selectionSet) {
    subFields = parseSelectionSet(fieldNode.selectionSet, [...pathStack, displayName], operationType);
  }

  return {
    fieldName,
    fieldPath,
    alias,
    subFields,
  };
}

export function loadQueryDocuments(filePaths: string[]): QueryDocument[] {
  const documents: QueryDocument[] = [];

  for (const filePath of filePaths) {
    const content = readFile(filePath);
    try {
      const doc = parseQueryDocument(filePath, content);
      documents.push(doc);
    } catch (e) {
      throw new Error(`查询文件解析失败 ${filePath}: ${(e as Error).message}`);
    }
  }

  return documents;
}

export function analyzeQueryImpact(
  documents: QueryDocument[],
  nullabilityChanges: NullabilityDiff[],
  schemaFields: SchemaField[]
): AffectedQuery[] {
  const affectedQueries: AffectedQuery[] = [];
  const changedPaths = new Set(nullabilityChanges.map((c) => c.fieldPath));

  const schemaFieldMap = new Map<string, SchemaField>();
  for (const field of schemaFields) {
    schemaFieldMap.set(field.fieldPath, field);
  }

  for (const doc of documents) {
    for (const operation of doc.operations) {
      const rootTypeName = operation.type === 'query' ? 'Query' : operation.type === 'mutation' ? 'Mutation' : 'Subscription';
      const affectedFields = findAffectedFieldsInOperation(
        operation.fields,
        nullabilityChanges,
        changedPaths,
        schemaFieldMap,
        rootTypeName,
        []
      );

      if (affectedFields.length > 0) {
        affectedQueries.push({
          documentPath: doc.filePath,
          operationName: operation.name,
          operationType: operation.type,
          affectedFields,
        });
      }
    }
  }

  return affectedQueries;
}

function findAffectedFieldsInOperation(
  queryFields: QueryField[],
  nullabilityChanges: NullabilityDiff[],
  changedPaths: Set<string>,
  schemaFieldMap: Map<string, SchemaField>,
  currentTypeName: string,
  pathStack: string[]
): AffectedField[] {
  const affected: AffectedField[] = [];

  for (const queryField of queryFields) {
    const schemaPath = `${currentTypeName}.${queryField.fieldName}`;
    const queryPath = [...pathStack, queryField.fieldName].join('.');

    if (changedPaths.has(schemaPath)) {
      const change = nullabilityChanges.find((c) => c.fieldPath === schemaPath);
      if (change) {
        affected.push({
          queryPath,
          schemaPath,
          changeType: change.changeType,
          fallbackRecommendation: getFallbackRecommendation(change.changeType, queryField.fieldName),
        });
      }
    }

    const schemaField = schemaFieldMap.get(schemaPath);
    if (schemaField && queryField.subFields.length > 0) {
      const nestedAffected = findAffectedFieldsInOperation(
        queryField.subFields,
        nullabilityChanges,
        changedPaths,
        schemaFieldMap,
        schemaField.typeInfo.innerType,
        [...pathStack, queryField.fieldName]
      );
      affected.push(...nestedAffected);
    }
  }

  return affected;
}

function getFallbackRecommendation(
  changeType: string,
  fieldName: string
): string {
  switch (changeType) {
    case 'NON_NULL_TO_NULLABLE':
      return `添加null检查: data?.${fieldName} || defaultValue`;
    case 'LIST_WRAPPER_NON_NULL_TO_NULLABLE':
      return `列表判空后遍历: (data?.${fieldName} || []).map(...)`;
    case 'LIST_INNER_NON_NULL_TO_NULLABLE':
      return `遍历时过滤null: data.${fieldName}.filter(Boolean).map(...)`;
    case 'FIELD_REMOVED':
      return `移除该字段查询或使用@skip/@include指令`;
    case 'NESTED_FIELD_NULL_DRIFT':
      return `使用可选链逐层访问: data?.a?.b?.c`;
    default:
      return `添加null安全访问逻辑`;
  }
}

export function collectAllQueryPaths(documents: QueryDocument[]): string[] {
  const paths: string[] = [];

  function collectFields(fields: QueryField[], prefix: string = '') {
    for (const field of fields) {
      const fullPath = prefix ? `${prefix}.${field.fieldName}` : field.fieldName;
      paths.push(fullPath);
      if (field.subFields.length > 0) {
        collectFields(field.subFields, fullPath);
      }
    }
  }

  for (const doc of documents) {
    for (const op of doc.operations) {
      collectFields(op.fields);
    }
  }

  return paths;
}
