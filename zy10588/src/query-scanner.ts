import { parse, visit, OperationDefinitionNode, FieldNode, SelectionSetNode, DocumentNode } from 'graphql';
import { readFileSync } from 'fs';
import { QuerySample, AnalysisError } from './types';

export function parseQueriesFile(filePath: string, clientTagPattern?: string): { queries: QuerySample[], errors: AnalysisError[] } {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const queries: QuerySample[] = [];
  const errors: AnalysisError[] = [];
  
  let currentQuery = '';
  let queryStartLine = 0;
  let inQuery = false;
  let currentClientTag = 'unknown';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (clientTagPattern) {
      const tagMatch = line.match(new RegExp(clientTagPattern));
      if (tagMatch) {
        currentClientTag = tagMatch[1] || tagMatch[0];
        continue;
      }
    }

    if (line.trim().startsWith('query') || line.trim().startsWith('mutation') || 
        line.trim().startsWith('subscription') || line.trim().startsWith('{')) {
      if (inQuery && currentQuery.trim()) {
        queries.push({
          query: currentQuery.trim(),
          clientTag: currentClientTag,
          source: filePath,
          lineNumber: queryStartLine
        });
      }
      inQuery = true;
      queryStartLine = lineNumber;
      currentQuery = line;
    } else if (inQuery) {
      currentQuery += '\n' + line;
      
      const braceCount = (currentQuery.match(/{/g) || []).length - (currentQuery.match(/}/g) || []).length;
      if (braceCount === 0 && currentQuery.trim().endsWith('}')) {
        queries.push({
          query: currentQuery.trim(),
          clientTag: currentClientTag,
          source: filePath,
          lineNumber: queryStartLine
        });
        inQuery = false;
        currentQuery = '';
      }
    }
  }

  if (inQuery && currentQuery.trim()) {
    errors.push({
      message: '未闭合的查询',
      source: filePath,
      lineNumber: queryStartLine,
      rawContent: currentQuery
    });
  }

  return { queries, errors };
}

export function extractFieldsFromQuery(
  query: string,
  clientTag: string = 'unknown'
): { fields: string[], clientTag: string } {
  const document = parse(query);
  const fields: string[] = [];

  function traverseSelectionSet(selectionSet: SelectionSetNode | undefined, parentPath: string) {
    if (!selectionSet) return;

    for (const selection of selectionSet.selections) {
      if (selection.kind === 'Field') {
        const fieldNode = selection as FieldNode;
        const fieldName = fieldNode.name.value;
        const fullPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;
        
        fields.push(fullPath);
        traverseSelectionSet(fieldNode.selectionSet, fullPath);
      } else if (selection.kind === 'InlineFragment') {
        traverseSelectionSet(selection.selectionSet, parentPath);
      } else if (selection.kind === 'FragmentSpread') {
      }
    }
  }

  function getOperationRootType(operation: OperationDefinitionNode): string {
    switch (operation.operation) {
      case 'query': return 'Query';
      case 'mutation': return 'Mutation';
      case 'subscription': return 'Subscription';
      default: return 'Query';
    }
  }

  for (const definition of document.definitions) {
    if (definition.kind === 'OperationDefinition') {
      const rootType = getOperationRootType(definition);
      traverseSelectionSet(definition.selectionSet, rootType);
    } else if (definition.kind === 'FragmentDefinition') {
      traverseSelectionSet(definition.selectionSet, definition.typeCondition.name.value);
    }
  }

  return { fields, clientTag };
}
