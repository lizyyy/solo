"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseQueryDocument = parseQueryDocument;
exports.loadQueryDocuments = loadQueryDocuments;
exports.analyzeQueryImpact = analyzeQueryImpact;
exports.collectAllQueryPaths = collectAllQueryPaths;
const graphql_1 = require("graphql");
const utils_1 = require("./utils");
function parseQueryDocument(filePath, content) {
    const ast = (0, graphql_1.parse)(content);
    const operations = [];
    const fragments = new Map();
    for (const definition of ast.definitions) {
        if (definition.kind === 'FragmentDefinition') {
            fragments.set(definition.name.value, definition);
        }
    }
    for (const definition of ast.definitions) {
        if (definition.kind === 'OperationDefinition') {
            const op = parseOperation(definition, fragments);
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
function parseOperation(opDef, fragments) {
    const name = opDef.name?.value || 'Anonymous';
    const type = mapOperationType(opDef.operation);
    if (!opDef.selectionSet) {
        return null;
    }
    const fields = parseSelectionSet(opDef.selectionSet, [], type, fragments);
    return {
        name,
        type,
        fields,
    };
}
function mapOperationType(op) {
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
function parseSelectionSet(selectionSet, pathStack, operationType, fragments) {
    const fields = [];
    for (const selection of selectionSet.selections) {
        if (selection.kind === 'Field') {
            const field = parseField(selection, pathStack, operationType, fragments);
            if (field) {
                fields.push(field);
            }
        }
        else if (selection.kind === 'InlineFragment') {
            const inlineFields = parseInlineFragment(selection, pathStack, operationType, fragments);
            fields.push(...inlineFields);
        }
        else if (selection.kind === 'FragmentSpread') {
            const spreadFields = parseFragmentSpread(selection, pathStack, operationType, fragments);
            fields.push(...spreadFields);
        }
    }
    return fields;
}
function parseInlineFragment(fragment, pathStack, operationType, fragments) {
    if (!fragment.selectionSet) {
        return [];
    }
    return parseSelectionSet(fragment.selectionSet, pathStack, operationType, fragments);
}
function parseFragmentSpread(spread, pathStack, operationType, fragments) {
    const fragment = fragments.get(spread.name.value);
    if (!fragment || !fragment.selectionSet) {
        return [];
    }
    return parseSelectionSet(fragment.selectionSet, pathStack, operationType, fragments);
}
function parseField(fieldNode, pathStack, operationType, fragments) {
    const fieldName = fieldNode.name.value;
    const alias = fieldNode.alias?.value;
    const displayName = alias || fieldName;
    const fieldPath = [...pathStack, displayName].join('.');
    let subFields = [];
    if (fieldNode.selectionSet) {
        subFields = parseSelectionSet(fieldNode.selectionSet, [...pathStack, displayName], operationType, fragments);
    }
    return {
        fieldName,
        fieldPath,
        alias,
        subFields,
    };
}
function loadQueryDocuments(filePaths) {
    const documents = [];
    for (const filePath of filePaths) {
        const content = (0, utils_1.readFile)(filePath);
        try {
            const doc = parseQueryDocument(filePath, content);
            documents.push(doc);
        }
        catch (e) {
            throw new Error(`查询文件解析失败 ${filePath}: ${e.message}`);
        }
    }
    return documents;
}
function analyzeQueryImpact(documents, nullabilityChanges, schemaFields, schemaTypeMap) {
    const affectedQueries = [];
    const changedPaths = new Set(nullabilityChanges.map((c) => c.fieldPath));
    const schemaFieldMap = new Map();
    for (const field of schemaFields) {
        schemaFieldMap.set(field.fieldPath, field);
    }
    for (const doc of documents) {
        for (const operation of doc.operations) {
            const rootTypeName = operation.type === 'query' ? 'Query' : operation.type === 'mutation' ? 'Mutation' : 'Subscription';
            const affectedFields = findAffectedFieldsInOperation(operation.fields, nullabilityChanges, changedPaths, schemaFieldMap, rootTypeName, [], schemaTypeMap);
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
function findAffectedFieldsInOperation(queryFields, nullabilityChanges, changedPaths, schemaFieldMap, currentTypeName, pathStack, schemaTypeMap) {
    const affected = [];
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
            const innerType = schemaField.typeInfo.innerType;
            const possibleTypes = schemaTypeMap?.get(innerType) || [innerType];
            for (const possibleType of possibleTypes) {
                const nestedAffected = findAffectedFieldsInOperation(queryField.subFields, nullabilityChanges, changedPaths, schemaFieldMap, possibleType, [...pathStack, queryField.fieldName], schemaTypeMap);
                affected.push(...nestedAffected);
            }
        }
    }
    return affected;
}
function getFallbackRecommendation(changeType, fieldName) {
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
function collectAllQueryPaths(documents) {
    const paths = [];
    function collectFields(fields, prefix = '') {
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
//# sourceMappingURL=query-analyzer.js.map