import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { parse, DocumentNode, OperationDefinitionNode, SelectionSetNode, FieldNode } from 'graphql';
import { 
  CachePolicy, 
  GraphQLOperation, 
  MutationEvent, 
  EntityKey,
  CacheEntry
} from './types';

export class Parser {
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.baseDir, filePath);
  }

  async parseSchema(schemaPath: string): Promise<DocumentNode> {
    const fullPath = this.resolvePath(schemaPath);
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return parse(content);
  }

  async parseCachePolicy(yamlPath: string): Promise<CachePolicy> {
    const fullPath = this.resolvePath(yamlPath);
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return yaml.load(content) as CachePolicy;
  }

  async parseOperations(jsonlPath: string): Promise<GraphQLOperation[]> {
    const fullPath = this.resolvePath(jsonlPath);
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => JSON.parse(line));
  }

  async parseMutationEvents(jsonlPath: string): Promise<MutationEvent[]> {
    const fullPath = this.resolvePath(jsonlPath);
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => JSON.parse(line));
  }

  extractOperationName(query: string): string {
    try {
      const document = parse(query);
      const operation = document.definitions.find(
        def => def.kind === 'OperationDefinition'
      ) as OperationDefinitionNode;
      
      if (operation?.name?.value) {
        return operation.name.value;
      }
      return 'AnonymousOperation';
    } catch {
      return 'UnknownOperation';
    }
  }

  extractEntityKeysFromResult(
    result: any,
    entityType: string,
    keyFields: string[] = ['id']
  ): EntityKey[] {
    const keys: EntityKey[] = [];
    
    if (!result) return keys;
    
    const extractFromObject = (obj: any, type: string) => {
      if (obj && typeof obj === 'object') {
        const idValue = keyFields.map(field => obj[field]).filter(v => v !== undefined).join(':');
        if (idValue) {
          keys.push({
            type: type,
            id: idValue,
            key: `${type}:${idValue}`
          });
        }
        
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (Array.isArray(obj[key])) {
              obj[key].forEach((item: any) => extractFromObject(item, key));
            } else {
              extractFromObject(obj[key], key);
            }
          }
        });
      }
    };
    
    const processData = (data: any) => {
      if (!data) return;
      
      Object.keys(data).forEach(fieldName => {
        const fieldValue = data[fieldName];
        if (Array.isArray(fieldValue)) {
          fieldValue.forEach(item => extractFromObject(item, entityType));
        } else if (fieldValue && typeof fieldValue === 'object') {
          extractFromObject(fieldValue, entityType);
        }
      });
    };
    
    if (result.data) {
      processData(result.data);
    } else {
      processData(result);
    }
    
    return keys;
  }

  generateCacheKey(
    operationName: string,
    query: string,
    variables: Record<string, any>
  ): string {
    const sortedVariables = Object.keys(variables)
      .sort()
      .map(key => `${key}:${JSON.stringify(variables[key])}`)
      .join(',');
    
    return `${operationName}:${this.hashString(query)}:${this.hashString(sortedVariables)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  detectEntityTypeFromSelectionSet(
    selectionSet: SelectionSetNode,
    schemaDocument: DocumentNode
  ): string | null {
    if (!selectionSet.selections.length) return null;
    
    const firstSelection = selectionSet.selections[0] as FieldNode;
    if (!firstSelection.name) return null;
    
    const fieldName = firstSelection.name.value;
    
    for (const def of schemaDocument.definitions) {
      if (def.kind === 'ObjectTypeDefinition' || def.kind === 'ObjectTypeExtension') {
        if (def.name.value === 'Query' || def.name.value === 'Mutation') {
          for (const field of def.fields || []) {
            if (field.name.value === fieldName) {
              const typeName = this.extractTypeName(field.type);
              if (typeName) return typeName;
            }
          }
        }
      }
    }
    
    return fieldName;
  }

  private extractTypeName(type: any): string | null {
    if (type.kind === 'NamedType') {
      return type.name.value;
    }
    if (type.kind === 'ListType' || type.kind === 'NonNullType') {
      return this.extractTypeName(type.type);
    }
    return null;
  }
}
