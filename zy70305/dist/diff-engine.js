"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractDiffEngine = void 0;
const uuid_1 = require("uuid");
class ContractDiffEngine {
    constructor(parser) {
        this.parser = parser;
    }
    compare(serviceName, oldSpec, newSpec) {
        const diffs = [];
        const oldPathMap = this.createPathMap(oldSpec);
        const newPathMap = this.createPathMap(newSpec);
        for (const [key, oldPath] of oldPathMap) {
            const newPath = newPathMap.get(key);
            if (!newPath) {
                diffs.push(this.createDiff(serviceName, oldPath.path, oldPath.method, 'path_deleted', `接口已删除: ${oldPath.method.toUpperCase()} ${oldPath.path}`, 'blocker', 'caller-must-change'));
            }
            else {
                diffs.push(...this.comparePaths(serviceName, oldSpec, newSpec, oldPath, newPath));
            }
        }
        for (const [key, newPath] of newPathMap) {
            if (!oldPathMap.has(key)) {
                diffs.push(this.createDiff(serviceName, newPath.path, newPath.method, 'path_added', `新增接口: ${newPath.method.toUpperCase()} ${newPath.path}`, 'info', 'ignorable'));
            }
        }
        return diffs;
    }
    createPathMap(spec) {
        const map = new Map();
        for (const path of spec.paths) {
            map.set(`${path.method}:${path.path}`, path);
        }
        return map;
    }
    comparePaths(serviceName, oldSpec, newSpec, oldPath, newPath) {
        const diffs = [];
        const oldParamMap = new Map();
        const newParamMap = new Map();
        for (const param of oldPath.parameters) {
            oldParamMap.set(`${param.in}:${param.name}`, param);
        }
        for (const param of newPath.parameters) {
            newParamMap.set(`${param.in}:${param.name}`, param);
        }
        for (const [key, oldParam] of oldParamMap) {
            const newParam = newParamMap.get(key);
            if (newParam) {
                if (!oldParam.required && newParam.required) {
                    diffs.push(this.createDiff(serviceName, oldPath.path, oldPath.method, 'request_param_required_added', `参数变必填: ${oldParam.in}.${oldParam.name}`, 'blocker', 'caller-must-change', oldParam.name));
                }
                else if (oldParam.required && !newParam.required) {
                    diffs.push(this.createDiff(serviceName, oldPath.path, oldPath.method, 'request_param_required_removed', `参数变可选: ${oldParam.in}.${oldParam.name}`, 'info', 'attention-only', oldParam.name));
                }
                const oldSchema = oldParam.schema ? this.parser.flattenSchema(oldSpec, oldParam.schema) : null;
                const newSchema = newParam.schema ? this.parser.flattenSchema(newSpec, newParam.schema) : null;
                if (oldSchema && newSchema && oldSchema.type !== newSchema.type) {
                    diffs.push(this.createDiff(serviceName, oldPath.path, oldPath.method, 'request_param_type_changed', `参数类型变化: ${oldParam.in}.${oldParam.name} ${oldSchema.type} -> ${newSchema.type}`, 'blocker', 'caller-must-change', oldParam.name, oldSchema.type, newSchema.type));
                }
            }
        }
        diffs.push(...this.compareRequestBody(serviceName, oldSpec, newSpec, oldPath, newPath));
        diffs.push(...this.compareResponses(serviceName, oldSpec, newSpec, oldPath, newPath));
        return diffs;
    }
    compareRequestBody(serviceName, oldSpec, newSpec, oldPath, newPath) {
        const diffs = [];
        if (!oldPath.requestBody && !newPath.requestBody)
            return diffs;
        if (!oldPath.requestBody && newPath.requestBody) {
            if (newPath.requestBody.required) {
                diffs.push(this.createDiff(serviceName, oldPath.path, oldPath.method, 'request_body_required_added', '新增必填请求体', 'blocker', 'caller-must-change'));
            }
            return diffs;
        }
        if (oldPath.requestBody && !newPath.requestBody) {
            diffs.push(this.createDiff(serviceName, oldPath.path, oldPath.method, 'request_body_required_removed', '请求体已移除', 'warning', 'attention-only'));
            return diffs;
        }
        const oldBody = oldPath.requestBody;
        const newBody = newPath.requestBody;
        if (!oldBody.required && newBody.required) {
            diffs.push(this.createDiff(serviceName, oldPath.path, oldPath.method, 'request_body_required_added', '请求体变必填', 'blocker', 'caller-must-change'));
        }
        const oldJsonSchema = oldBody.content['application/json'];
        const newJsonSchema = newBody.content['application/json'];
        if (oldJsonSchema && newJsonSchema) {
            const oldFlat = this.parser.flattenSchema(oldSpec, oldJsonSchema);
            const newFlat = this.parser.flattenSchema(newSpec, newJsonSchema);
            diffs.push(...this.compareSchemas(serviceName, oldPath.path, oldPath.method, oldFlat, newFlat, 'request'));
        }
        return diffs;
    }
    compareResponses(serviceName, oldSpec, newSpec, oldPath, newPath) {
        const diffs = [];
        const oldRespMap = new Map();
        const newRespMap = new Map();
        for (const resp of oldPath.responses) {
            oldRespMap.set(resp.statusCode, resp);
        }
        for (const resp of newPath.responses) {
            newRespMap.set(resp.statusCode, resp);
        }
        for (const [code, oldResp] of oldRespMap) {
            const newResp = newRespMap.get(code);
            if (!newResp) {
                diffs.push(this.createDiff(serviceName, oldPath.path, oldPath.method, 'response_status_deleted', `响应状态码已移除: ${code}`, 'blocker', 'caller-must-change', undefined, undefined, undefined, undefined, [code]));
            }
            else {
                const oldJsonSchema = oldResp.content['application/json'];
                const newJsonSchema = newResp.content['application/json'];
                if (oldJsonSchema && newJsonSchema) {
                    const oldFlat = this.parser.flattenSchema(oldSpec, oldJsonSchema);
                    const newFlat = this.parser.flattenSchema(newSpec, newJsonSchema);
                    diffs.push(...this.compareSchemas(serviceName, oldPath.path, oldPath.method, oldFlat, newFlat, 'response', code));
                }
            }
        }
        for (const [code] of newRespMap) {
            if (!oldRespMap.has(code)) {
                diffs.push(this.createDiff(serviceName, oldPath.path, oldPath.method, 'response_status_added', `新增响应状态码: ${code}`, 'info', 'ignorable', undefined, undefined, undefined, undefined, [code]));
            }
        }
        return diffs;
    }
    compareSchemas(serviceName, path, method, oldSchema, newSchema, location, responseCode, prefix = '') {
        const diffs = [];
        const oldProps = oldSchema.properties || {};
        const newProps = newSchema.properties || {};
        const oldRequired = new Set(oldSchema.required || []);
        const newRequired = new Set(newSchema.required || []);
        for (const [fieldName, oldProp] of Object.entries(oldProps)) {
            const newProp = newProps[fieldName];
            const fullField = prefix ? `${prefix}.${fieldName}` : fieldName;
            if (!newProp) {
                if (location === 'request') {
                    diffs.push(this.createDiff(serviceName, path, method, 'request_body_field_deleted', `请求体字段已删除: ${fullField}`, 'warning', 'attention-only', fullField));
                }
                else {
                    diffs.push(this.createDiff(serviceName, path, method, 'response_field_deleted', `响应字段已删除: ${fullField}${responseCode ? ` (${responseCode})` : ''}`, 'blocker', 'caller-must-change', fullField));
                }
                continue;
            }
            const wasRequired = oldRequired.has(fieldName);
            const isRequired = newRequired.has(fieldName);
            if (!wasRequired && isRequired) {
                if (location === 'request') {
                    diffs.push(this.createDiff(serviceName, path, method, 'request_body_required_added', `请求体字段变必填: ${fullField}`, 'blocker', 'caller-must-change', fullField));
                }
            }
            else if (wasRequired && !isRequired) {
                if (location === 'request') {
                    diffs.push(this.createDiff(serviceName, path, method, 'request_body_required_removed', `请求体字段变可选: ${fullField}`, 'info', 'ignorable', fullField));
                }
            }
            if (oldProp.type && newProp.type && oldProp.type !== newProp.type) {
                const changeType = location === 'request' ? 'request_body_field_type_changed' : 'response_field_type_changed';
                diffs.push(this.createDiff(serviceName, path, method, changeType, `${location === 'request' ? '请求体' : '响应'}字段类型变化: ${fullField} ${oldProp.type} -> ${newProp.type}${responseCode ? ` (${responseCode})` : ''}`, 'blocker', 'caller-must-change', fullField, oldProp.type, newProp.type));
            }
            if (oldProp.enum && newProp.enum) {
                const oldEnumSet = new Set(oldProp.enum);
                const newEnumSet = new Set(newProp.enum);
                const removedValues = oldProp.enum.filter(v => !newEnumSet.has(v));
                const addedValues = newProp.enum.filter(v => !oldEnumSet.has(v));
                if (removedValues.length > 0) {
                    diffs.push(this.createDiff(serviceName, path, method, 'enum_value_removed', `枚举值收窄: ${fullField} 移除了 [${removedValues.join(', ')}]${responseCode ? ` (${responseCode})` : ''}`, 'blocker', 'caller-must-change', fullField, undefined, undefined, removedValues));
                }
                if (addedValues.length > 0) {
                    diffs.push(this.createDiff(serviceName, path, method, 'enum_value_added', `枚举值扩展: ${fullField} 新增 [${addedValues.join(', ')}]${responseCode ? ` (${responseCode})` : ''}`, 'warning', 'attention-only', fullField, undefined, undefined, addedValues));
                }
            }
            else if (oldProp.enum && !newProp.enum) {
                diffs.push(this.createDiff(serviceName, path, method, 'enum_value_removed', `枚举约束移除: ${fullField}${responseCode ? ` (${responseCode})` : ''}`, 'info', 'attention-only', fullField));
            }
            if (oldProp.properties &&
                newProp.properties &&
                Object.keys(oldProp.properties).length > 0) {
                diffs.push(...this.compareSchemas(serviceName, path, method, oldProp, newProp, location, responseCode, fullField));
            }
            if (oldProp.items && newProp.items) {
                diffs.push(...this.compareSchemas(serviceName, path, method, oldProp.items, newProp.items, location, responseCode, `${fullField}[]`));
            }
        }
        for (const [fieldName] of Object.entries(newProps)) {
            if (!oldProps[fieldName]) {
                const fullField = prefix ? `${prefix}.${fieldName}` : fieldName;
                if (location === 'request') {
                    if (newRequired.has(fieldName)) {
                        diffs.push(this.createDiff(serviceName, path, method, 'request_body_field_added', `新增必填请求体字段: ${fullField}`, 'blocker', 'caller-must-change', fullField));
                    }
                    else {
                        diffs.push(this.createDiff(serviceName, path, method, 'request_body_field_added', `新增可选请求体字段: ${fullField}`, 'info', 'ignorable', fullField));
                    }
                }
                else {
                    diffs.push(this.createDiff(serviceName, path, method, 'response_field_added', `新增响应字段: ${fullField}${responseCode ? ` (${responseCode})` : ''}`, 'info', 'ignorable', fullField));
                }
            }
        }
        return diffs;
    }
    createDiff(serviceName, path, method, changeType, description, severity, impact, field, oldValue, newValue, affectedEnumValues, affectedResponseCodes) {
        return {
            id: (0, uuid_1.v4)(),
            serviceName,
            path,
            method,
            changeType,
            field,
            oldValue,
            newValue,
            description,
            severity,
            impact,
            affectedEnumValues,
            affectedResponseCodes
        };
    }
}
exports.ContractDiffEngine = ContractDiffEngine;
//# sourceMappingURL=diff-engine.js.map