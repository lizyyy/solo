import { buildClientSchema, buildSchema, GraphQLSchema, isObjectType, isInterfaceType, isUnionType, GraphQLOutputType, isListType, isNonNullType } from 'graphql';
import { readFileSync } from 'fs';

export function parseSchema(schemaPath: string): GraphQLSchema {
  try {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    return buildSchema(schemaContent);
  } catch (error) {
    throw new Error(`解析Schema失败: ${(error as Error).message}`);
  }
}

export function getFieldTypeMap(schema: GraphQLSchema): Map<string, string> {
  const typeMap = new Map<string, string>();
  const typeMapSchema = schema.getTypeMap();

  for (const [typeName, type] of Object.entries(typeMapSchema)) {
    if (typeName.startsWith('__')) continue;

    if (isObjectType(type) || isInterfaceType(type)) {
      const fields = type.getFields();
      for (const [fieldName, field] of Object.entries(fields)) {
        const fullPath = `${typeName}.${fieldName}`;
        typeMap.set(fullPath, getTypeName(field.type));
      }
    }
  }

  return typeMap;
}

function getTypeName(type: GraphQLOutputType): string {
  if (isListType(type) || isNonNullType(type)) {
    return getTypeName(type.ofType);
  }
  return type.name;
}

export function getAllSchemaFields(schema: GraphQLSchema): Set<string> {
  const fields = new Set<string>();
  const typeMap = schema.getTypeMap();

  for (const [typeName, type] of Object.entries(typeMap)) {
    if (typeName.startsWith('__')) continue;

    if (isObjectType(type) || isInterfaceType(type)) {
      const fieldMap = type.getFields();
      for (const fieldName of Object.keys(fieldMap)) {
        fields.add(`${typeName}.${fieldName}`);
      }
    }
  }

  return fields;
}
