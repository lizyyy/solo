import { buildClientSchema, buildSchema, GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLList, GraphQLType, isObjectType, isScalarType, isEnumType, isInputObjectType, isInterfaceType, isUnionType } from 'graphql';
import { SchemaField, FieldTypeInfo, NullabilityDiff, NullabilityChangeType, SchemaDiffSummary } from './types';
import { parseFieldType, readFile } from './utils';

export function parseSchema(schemaContent: string): GraphQLSchema {
  try {
    const parsed = JSON.parse(schemaContent);
    if (parsed.__schema) {
      return buildClientSchema(parsed);
    }
    throw new Error('Invalid introspection JSON');
  } catch {
    return buildSchema(schemaContent);
  }
}

export function loadSchema(filePath: string): GraphQLSchema {
  const content = readFile(filePath);
  return parseSchema(content);
}

export function extractFieldTypeInfo(fieldType: GraphQLType): FieldTypeInfo {
  let isNonNull = false;
  let isList = false;
  let listInnerNonNull = false;
  let innerTypeName = '';
  let rawType = fieldType;

  if (rawType instanceof GraphQLNonNull) {
    isNonNull = true;
    rawType = rawType.ofType;
  }

  if (rawType instanceof GraphQLList) {
    isList = true;
    rawType = rawType.ofType;
    if (rawType instanceof GraphQLNonNull) {
      listInnerNonNull = true;
      rawType = rawType.ofType;
    }
  }

  innerTypeName = rawType.toString();

  return {
    isNonNull,
    isList,
    innerType: innerTypeName,
    fullType: fieldType.toString(),
    rawType: innerTypeName,
    listInnerNonNull,
  };
}

export function extractAllFields(schema: GraphQLSchema): SchemaField[] {
  const fields: SchemaField[] = [];
  const typeMap = schema.getTypeMap();

  for (const [typeName, type] of Object.entries(typeMap)) {
    if (typeName.startsWith('__')) continue;

    if (isObjectType(type) || isInputObjectType(type) || isInterfaceType(type)) {
      const fieldMap = type.getFields();
      for (const [fieldName, field] of Object.entries(fieldMap)) {
        const fieldPath = `${typeName}.${fieldName}`;
        fields.push({
          typeName,
          fieldName,
          fieldPath,
          typeInfo: extractFieldTypeInfo((field as any).type),
          description: field.description || undefined,
        });
      }
    }
  }

  return fields;
}

export function extractTypeMap(schema: GraphQLSchema): Map<string, string[]> {
  const typeMap = new Map<string, string[]>();
  const schemaTypeMap = schema.getTypeMap();

  for (const [typeName, type] of Object.entries(schemaTypeMap)) {
    if (typeName.startsWith('__')) continue;

    if (isUnionType(type)) {
      const types = type.getTypes().map((t) => t.name);
      typeMap.set(typeName, types);
    } else if (isObjectType(type)) {
      typeMap.set(typeName, [typeName]);
    }
  }

  return typeMap;
}

function buildFieldsMap(fields: SchemaField[]): Map<string, SchemaField> {
  const map = new Map<string, SchemaField>();
  for (const field of fields) {
    map.set(field.fieldPath, field);
  }
  return map;
}

function getRuleExplanation(changeType: NullabilityChangeType): string {
  switch (changeType) {
    case 'NON_NULL_TO_NULLABLE':
      return '字段从非空(!)变为可空，客户端必须添加null检查或兜底逻辑，否则可能导致运行时崩溃。';
    case 'LIST_INNER_NON_NULL_TO_NULLABLE':
      return '列表内部元素从非空变为可空，遍历列表时必须检查每个元素是否为null，否则数组访问时崩溃。';
    case 'LIST_WRAPPER_NON_NULL_TO_NULLABLE':
      return '列表外层从非空变为可空，列表本身可能为null，需要先判空后再遍历。';
    case 'NESTED_FIELD_NULL_DRIFT':
      return '嵌套字段的父级或子级发生空值漂移，整条路径都可能返回null，需要逐层检查。';
    case 'TYPE_REPLACED_WITH_NULLABLE':
      return '字段类型被替换为可空类型，需要更新类型定义和处理逻辑。';
    case 'FIELD_REMOVED':
      return '字段被移除，客户端查询会失败，需要更新查询或使用@skip指令。';
    default:
      return '未知变更类型，请检查schema变更。';
  }
}

function getSeverity(changeType: NullabilityChangeType): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  switch (changeType) {
    case 'FIELD_REMOVED':
      return 'CRITICAL';
    case 'NON_NULL_TO_NULLABLE':
      return 'HIGH';
    case 'LIST_INNER_NON_NULL_TO_NULLABLE':
      return 'HIGH';
    case 'LIST_WRAPPER_NON_NULL_TO_NULLABLE':
      return 'HIGH';
    case 'NESTED_FIELD_NULL_DRIFT':
      return 'MEDIUM';
    case 'TYPE_REPLACED_WITH_NULLABLE':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

function getChangeDescription(changeType: NullabilityChangeType, oldType: FieldTypeInfo, newType: FieldTypeInfo): string {
  switch (changeType) {
    case 'NON_NULL_TO_NULLABLE':
      return `字段从 ${oldType.fullType} → ${newType.fullType}，失去了非空保证`;
    case 'LIST_INNER_NON_NULL_TO_NULLABLE':
      return `列表元素从 [${oldType.innerType}!] → [${newType.innerType}]，元素可能为null`;
    case 'LIST_WRAPPER_NON_NULL_TO_NULLABLE':
      return `列表从 [${oldType.innerType}]! → [${newType.innerType}]，列表本身可能为null`;
    case 'NESTED_FIELD_NULL_DRIFT':
      return `嵌套字段路径中存在空值漂移`;
    case 'TYPE_REPLACED_WITH_NULLABLE':
      return `类型从 ${oldType.innerType} 替换为 ${newType.innerType}`;
    case 'FIELD_REMOVED':
      return `字段已被移除`;
    default:
      return `未知变更`;
  }
}

function compareFieldNullability(
  oldField: SchemaField,
  newField: SchemaField | undefined,
  allOldFields: Map<string, SchemaField>,
  allNewFields: Map<string, SchemaField>
): NullabilityDiff | null {
  if (!newField) {
    return {
      fieldPath: oldField.fieldPath,
      typeName: oldField.typeName,
      fieldName: oldField.fieldName,
      changeType: 'FIELD_REMOVED',
      oldType: oldField.typeInfo,
      newType: { isNonNull: false, isList: false, innerType: 'null', fullType: 'null', rawType: 'null', listInnerNonNull: false },
      severity: getSeverity('FIELD_REMOVED'),
      description: getChangeDescription('FIELD_REMOVED', oldField.typeInfo, oldField.typeInfo),
      ruleExplanation: getRuleExplanation('FIELD_REMOVED'),
    };
  }

  const oldInfo = oldField.typeInfo;
  const newInfo = newField.typeInfo;

  if (oldInfo.isNonNull && !newInfo.isNonNull) {
    if (oldInfo.isList) {
      const changeType: NullabilityChangeType = 'LIST_WRAPPER_NON_NULL_TO_NULLABLE';
      return {
        fieldPath: oldField.fieldPath,
        typeName: oldField.typeName,
        fieldName: oldField.fieldName,
        changeType,
        oldType: oldInfo,
        newType: newInfo,
        severity: getSeverity(changeType),
        description: getChangeDescription(changeType, oldInfo, newInfo),
        ruleExplanation: getRuleExplanation(changeType),
      };
    } else {
      const changeType: NullabilityChangeType = 'NON_NULL_TO_NULLABLE';
      return {
        fieldPath: oldField.fieldPath,
        typeName: oldField.typeName,
        fieldName: oldField.fieldName,
        changeType,
        oldType: oldInfo,
        newType: newInfo,
        severity: getSeverity(changeType),
        description: getChangeDescription(changeType, oldInfo, newInfo),
        ruleExplanation: getRuleExplanation(changeType),
      };
    }
  }

  if (oldInfo.isList && newInfo.isList) {
    if (oldInfo.listInnerNonNull && !newInfo.listInnerNonNull) {
      const changeType: NullabilityChangeType = 'LIST_INNER_NON_NULL_TO_NULLABLE';
      return {
        fieldPath: oldField.fieldPath,
        typeName: oldField.typeName,
        fieldName: oldField.fieldName,
        changeType,
        oldType: oldInfo,
        newType: newInfo,
        severity: getSeverity(changeType),
        description: getChangeDescription(changeType, oldInfo, newInfo),
        ruleExplanation: getRuleExplanation(changeType),
      };
    }
  }

  if (oldInfo.innerType !== newInfo.innerType) {
    const oldInnerField = allOldFields.get(`${oldInfo.innerType}.id`);
    const newInnerField = allNewFields.get(`${newInfo.innerType}.id`);
    if (oldInnerField && newInnerField) {
    }
  }

  return null;
}

export function detectNestedNullDrift(
  oldFields: SchemaField[],
  newFields: SchemaField[],
  typeMap?: Map<string, string[]>
): NullabilityDiff[] {
  const changes: NullabilityDiff[] = [];
  const oldMap = buildFieldsMap(oldFields);
  const newMap = buildFieldsMap(newFields);

  const processedPaths = new Set<string>();

  function checkPath(
    typeName: string,
    fieldName: string,
    pathStack: string[]
  ): void {
    const fieldPath = `${typeName}.${fieldName}`;
    const fullPath = [...pathStack, fieldPath].join('.');

    if (processedPaths.has(fullPath)) return;
    processedPaths.add(fullPath);

    const oldField = oldMap.get(fieldPath);
    const newField = newMap.get(fieldPath);

    if (!oldField) return;

    const diff = compareFieldNullability(oldField, newField, oldMap, newMap);
    if (diff) {
      changes.push(diff);
    }

    if (newField) {
      const innerType = newField.typeInfo.innerType;
      
      const possibleTypes = typeMap?.get(innerType) || [innerType];
      
      for (const possibleType of possibleTypes) {
        const innerTypeFields = newFields.filter((f) => f.typeName === possibleType);
        for (const innerField of innerTypeFields) {
          checkPath(possibleType, innerField.fieldName, [...pathStack, fieldPath]);
        }
      }
    }
  }

  const queryType = oldFields.find((f) => f.typeName === 'Query');
  if (queryType) {
    const rootQueryFields = oldFields.filter((f) => f.typeName === 'Query');
    for (const field of rootQueryFields) {
      checkPath('Query', field.fieldName, []);
    }
  }

  const mutationType = oldFields.find((f) => f.typeName === 'Mutation');
  if (mutationType) {
    const rootMutationFields = oldFields.filter((f) => f.typeName === 'Mutation');
    for (const field of rootMutationFields) {
      checkPath('Mutation', field.fieldName, []);
    }
  }

  return changes;
}

export function compareSchemas(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): {
  changes: NullabilityDiff[];
  summary: SchemaDiffSummary;
  oldFields: SchemaField[];
  newFields: SchemaField[];
  typeMap: Map<string, string[]>;
} {
  const oldFields = extractAllFields(oldSchema);
  const newFields = extractAllFields(newSchema);
  const typeMap = extractTypeMap(newSchema);

  const oldMap = buildFieldsMap(oldFields);
  const newMap = buildFieldsMap(newFields);

  const changes: NullabilityDiff[] = [];
  let fieldsAdded = 0;
  let fieldsRemoved = 0;
  let typesAdded = 0;
  let typesRemoved = 0;

  const oldTypeNames = new Set(oldFields.map((f) => f.typeName));
  const newTypeNames = new Set(newFields.map((f) => f.typeName));

  for (const typeName of oldTypeNames) {
    if (!newTypeNames.has(typeName)) {
      typesRemoved++;
    }
  }

  for (const typeName of newTypeNames) {
    if (!oldTypeNames.has(typeName)) {
      typesAdded++;
    }
  }

  for (const [fieldPath, oldField] of oldMap.entries()) {
    if (!newMap.has(fieldPath)) {
      fieldsRemoved++;
      const diff = compareFieldNullability(oldField, undefined, oldMap, newMap);
      if (diff) {
        changes.push(diff);
      }
    }
  }

  for (const [fieldPath] of newMap.entries()) {
    if (!oldMap.has(fieldPath)) {
      fieldsAdded++;
    }
  }

  const nullabilityChanges = detectNestedNullDrift(oldFields, newFields, typeMap);
  changes.push(...nullabilityChanges);

  const uniqueChanges = Array.from(new Map(changes.map((c) => [c.fieldPath, c])).values());

  return {
    changes: uniqueChanges,
    summary: {
      totalFieldsChecked: oldFields.length,
      fieldsAdded,
      fieldsRemoved,
      typesAdded,
      typesRemoved,
      nullabilityChangesCount: uniqueChanges.length,
    },
    oldFields,
    newFields,
    typeMap,
  };
}
