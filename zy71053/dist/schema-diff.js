"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSchema = parseSchema;
exports.loadSchema = loadSchema;
exports.extractFieldTypeInfo = extractFieldTypeInfo;
exports.extractAllFields = extractAllFields;
exports.detectNestedNullDrift = detectNestedNullDrift;
exports.compareSchemas = compareSchemas;
const graphql_1 = require("graphql");
const utils_1 = require("./utils");
function parseSchema(schemaContent) {
    try {
        const parsed = JSON.parse(schemaContent);
        if (parsed.__schema) {
            return (0, graphql_1.buildClientSchema)(parsed);
        }
        throw new Error('Invalid introspection JSON');
    }
    catch {
        return (0, graphql_1.buildSchema)(schemaContent);
    }
}
function loadSchema(filePath) {
    const content = (0, utils_1.readFile)(filePath);
    return parseSchema(content);
}
function extractFieldTypeInfo(fieldType) {
    let isNonNull = false;
    let isList = false;
    let listInnerNonNull = false;
    let innerTypeName = '';
    let rawType = fieldType;
    if (rawType instanceof graphql_1.GraphQLNonNull) {
        isNonNull = true;
        rawType = rawType.ofType;
    }
    if (rawType instanceof graphql_1.GraphQLList) {
        isList = true;
        rawType = rawType.ofType;
        if (rawType instanceof graphql_1.GraphQLNonNull) {
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
function extractAllFields(schema) {
    const fields = [];
    const typeMap = schema.getTypeMap();
    for (const [typeName, type] of Object.entries(typeMap)) {
        if (typeName.startsWith('__'))
            continue;
        if ((0, graphql_1.isObjectType)(type) || (0, graphql_1.isInputObjectType)(type) || (0, graphql_1.isInterfaceType)(type)) {
            const fieldMap = type.getFields();
            for (const [fieldName, field] of Object.entries(fieldMap)) {
                const fieldPath = `${typeName}.${fieldName}`;
                fields.push({
                    typeName,
                    fieldName,
                    fieldPath,
                    typeInfo: extractFieldTypeInfo(field.type),
                    description: field.description || undefined,
                });
            }
        }
    }
    return fields;
}
function buildFieldsMap(fields) {
    const map = new Map();
    for (const field of fields) {
        map.set(field.fieldPath, field);
    }
    return map;
}
function getRuleExplanation(changeType) {
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
function getSeverity(changeType) {
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
function getChangeDescription(changeType, oldType, newType) {
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
function compareFieldNullability(oldField, newField, allOldFields, allNewFields) {
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
            const changeType = 'LIST_WRAPPER_NON_NULL_TO_NULLABLE';
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
        else {
            const changeType = 'NON_NULL_TO_NULLABLE';
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
            const changeType = 'LIST_INNER_NON_NULL_TO_NULLABLE';
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
function detectNestedNullDrift(oldFields, newFields) {
    const changes = [];
    const oldMap = buildFieldsMap(oldFields);
    const newMap = buildFieldsMap(newFields);
    const processedPaths = new Set();
    function checkPath(typeName, fieldName, pathStack) {
        const fieldPath = `${typeName}.${fieldName}`;
        const fullPath = [...pathStack, fieldPath].join('.');
        if (processedPaths.has(fullPath))
            return;
        processedPaths.add(fullPath);
        const oldField = oldMap.get(fieldPath);
        const newField = newMap.get(fieldPath);
        if (!oldField)
            return;
        const diff = compareFieldNullability(oldField, newField, oldMap, newMap);
        if (diff) {
            changes.push(diff);
        }
        if (newField) {
            const innerType = newField.typeInfo.innerType;
            const innerTypeFields = newFields.filter((f) => f.typeName === innerType);
            for (const innerField of innerTypeFields) {
                checkPath(innerType, innerField.fieldName, [...pathStack, fieldPath]);
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
function compareSchemas(oldSchema, newSchema) {
    const oldFields = extractAllFields(oldSchema);
    const newFields = extractAllFields(newSchema);
    const oldMap = buildFieldsMap(oldFields);
    const newMap = buildFieldsMap(newFields);
    const changes = [];
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
    const nullabilityChanges = detectNestedNullDrift(oldFields, newFields);
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
    };
}
//# sourceMappingURL=schema-diff.js.map