"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSchema = parseSchema;
exports.getFieldTypeMap = getFieldTypeMap;
exports.getAllSchemaFields = getAllSchemaFields;
const graphql_1 = require("graphql");
const fs_1 = require("fs");
function parseSchema(schemaPath) {
    try {
        const schemaContent = (0, fs_1.readFileSync)(schemaPath, 'utf-8');
        return (0, graphql_1.buildSchema)(schemaContent);
    }
    catch (error) {
        throw new Error(`解析Schema失败: ${error.message}`);
    }
}
function getFieldTypeMap(schema) {
    const typeMap = new Map();
    const typeMapSchema = schema.getTypeMap();
    for (const [typeName, type] of Object.entries(typeMapSchema)) {
        if (typeName.startsWith('__'))
            continue;
        if ((0, graphql_1.isObjectType)(type) || (0, graphql_1.isInterfaceType)(type)) {
            const fields = type.getFields();
            for (const [fieldName, field] of Object.entries(fields)) {
                const fullPath = `${typeName}.${fieldName}`;
                typeMap.set(fullPath, getTypeName(field.type));
            }
        }
    }
    return typeMap;
}
function getTypeName(type) {
    if ((0, graphql_1.isListType)(type) || (0, graphql_1.isNonNullType)(type)) {
        return getTypeName(type.ofType);
    }
    return type.name;
}
function getAllSchemaFields(schema) {
    const fields = new Set();
    const typeMap = schema.getTypeMap();
    for (const [typeName, type] of Object.entries(typeMap)) {
        if (typeName.startsWith('__'))
            continue;
        if ((0, graphql_1.isObjectType)(type) || (0, graphql_1.isInterfaceType)(type)) {
            const fieldMap = type.getFields();
            for (const fieldName of Object.keys(fieldMap)) {
                fields.add(`${typeName}.${fieldName}`);
            }
        }
    }
    return fields;
}
