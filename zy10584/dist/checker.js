"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationConsistencyChecker = void 0;
const parser_1 = require("./parser");
class PaginationConsistencyChecker {
    constructor(parser, config) {
        this.parser = parser;
        this.config = {
            ...parser_1.OpenAPIParser.getDefaultConfig(),
            ...config
        };
        this.canonicalParamName = {
            page: this.config.expectedParams.page[0],
            pageSize: this.config.expectedParams.pageSize[0]
        };
        this.canonicalFieldName = {
            data: this.config.expectedResponseFields.data[0],
            total: this.config.expectedResponseFields.total[0],
            page: this.config.expectedResponseFields.page[0],
            pageSize: this.config.expectedResponseFields.pageSize[0],
            totalPages: this.config.expectedResponseFields.totalPages?.[0] || 'totalPages'
        };
    }
    check() {
        const spec = this.parser.getSpec();
        const endpoints = [];
        const allInconsistencies = [];
        const methods = this.config.httpMethods || ['get'];
        for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
            if (this.shouldExcludePath(pathStr))
                continue;
            if (!this.shouldIncludePath(pathStr))
                continue;
            for (const method of methods) {
                const operation = pathItem[method.toLowerCase()];
                if (!operation)
                    continue;
                const analysis = this.analyzeEndpoint(pathStr, method, operation);
                endpoints.push(analysis);
                allInconsistencies.push(...analysis.inconsistencies);
            }
        }
        const inconsistentEndpoints = endpoints.filter(e => e.inconsistencies.some(i => i.severity === 'error')).length;
        return {
            summary: {
                totalEndpoints: endpoints.length,
                paginationEndpoints: endpoints.filter(e => e.isPaginationEndpoint).length,
                inconsistentEndpoints,
                totalInconsistencies: allInconsistencies.filter(i => i.severity === 'error').length,
                bySeverity: {
                    error: allInconsistencies.filter(i => i.severity === 'error').length,
                    warning: allInconsistencies.filter(i => i.severity === 'warning').length,
                    info: allInconsistencies.filter(i => i.severity === 'info').length
                }
            },
            endpoints,
            inconsistencies: allInconsistencies,
            config: this.config,
            timestamp: new Date().toISOString(),
            openapiFile: this.parser.getFilePath()
        };
    }
    shouldExcludePath(pathStr) {
        if (!this.config.excludePaths)
            return false;
        return this.config.excludePaths.some(pattern => new RegExp(pattern.replace(/\*/g, '.*')).test(pathStr));
    }
    shouldIncludePath(pathStr) {
        if (!this.config.includePaths || this.config.includePaths.length === 0)
            return true;
        return this.config.includePaths.some(pattern => new RegExp(pattern.replace(/\*/g, '.*')).test(pathStr));
    }
    analyzeEndpoint(pathStr, method, operation) {
        const inconsistencies = [];
        const queryParams = this.extractQueryParams(operation);
        const responseSchema = this.getSuccessResponseSchema(operation);
        const responseFields = responseSchema ? this.parser.extractResponseFields(responseSchema) : [];
        const paginationParams = this.identifyPaginationParams(queryParams);
        const responsePaginationFields = this.identifyResponsePaginationFields(responseFields);
        const isPaginationEndpoint = this.isLikelyPaginationEndpoint(paginationParams, responsePaginationFields);
        if (isPaginationEndpoint) {
            inconsistencies.push(...this.checkParamConsistency(pathStr, method, paginationParams));
            inconsistencies.push(...this.checkResponseConsistency(pathStr, method, responsePaginationFields, responseSchema));
        }
        return {
            path: pathStr,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            paginationParams: {
                page: paginationParams.page,
                pageSize: paginationParams.pageSize,
                allParams: queryParams.map(p => p.name)
            },
            responseFields: {
                data: responsePaginationFields.data,
                total: responsePaginationFields.total,
                page: responsePaginationFields.page,
                pageSize: responsePaginationFields.pageSize,
                totalPages: responsePaginationFields.totalPages,
                allFields: responseFields
            },
            inconsistencies,
            isPaginationEndpoint
        };
    }
    extractQueryParams(operation) {
        const params = [];
        if (operation.parameters) {
            params.push(...operation.parameters.filter(p => p.in === 'query'));
        }
        return params;
    }
    getSuccessResponseSchema(operation) {
        const successCodes = ['200', '201', '202', 'default'];
        for (const code of successCodes) {
            if (operation.responses[code]) {
                return this.parser.getResponseSchema(operation.responses[code]);
            }
        }
        return null;
    }
    identifyPaginationParams(queryParams) {
        const paramNames = queryParams.map(p => p.name.toLowerCase());
        const findMatch = (expected) => {
            for (const expectedName of expected) {
                const match = queryParams.find(p => p.name.toLowerCase() === expectedName.toLowerCase());
                if (match)
                    return match.name;
            }
            return undefined;
        };
        return {
            page: findMatch(this.config.expectedParams.page),
            pageSize: findMatch(this.config.expectedParams.pageSize),
            allParams: queryParams
        };
    }
    identifyResponsePaginationFields(fields) {
        const findMatch = (expected) => {
            for (const expectedName of expected) {
                const match = fields.find(f => f.toLowerCase() === expectedName.toLowerCase());
                if (match)
                    return match;
            }
            return undefined;
        };
        return {
            data: findMatch(this.config.expectedResponseFields.data),
            total: findMatch(this.config.expectedResponseFields.total),
            page: findMatch(this.config.expectedResponseFields.page),
            pageSize: findMatch(this.config.expectedResponseFields.pageSize),
            totalPages: this.config.expectedResponseFields.totalPages
                ? findMatch(this.config.expectedResponseFields.totalPages)
                : undefined,
            allFields: fields
        };
    }
    isLikelyPaginationEndpoint(params, fields) {
        const paramScore = (params.page ? 1 : 0) + (params.pageSize ? 1 : 0);
        const fieldScore = (fields.data ? 1 : 0) + (fields.total ? 1 : 0);
        return paramScore + fieldScore >= 2;
    }
    checkParamConsistency(pathStr, method, params) {
        const inconsistencies = [];
        if (!params.page) {
            inconsistencies.push({
                type: 'param_missing',
                severity: 'error',
                message: `缺少分页参数: ${this.canonicalParamName.page}`,
                location: { path: pathStr, method },
                expected: this.config.expectedParams.page,
                suggestion: `建议添加 ${this.canonicalParamName.page} 参数`
            });
        }
        else if (params.page !== this.canonicalParamName.page) {
            inconsistencies.push({
                type: 'param_name',
                severity: 'warning',
                message: `分页参数命名不一致: "${params.page}" (期望 "${this.canonicalParamName.page}")`,
                location: { path: pathStr, method, paramName: params.page },
                expected: [this.canonicalParamName.page],
                actual: params.page,
                suggestion: `建议重命名为 ${this.canonicalParamName.page}`
            });
        }
        if (!params.pageSize) {
            inconsistencies.push({
                type: 'param_missing',
                severity: 'error',
                message: `缺少分页参数: ${this.canonicalParamName.pageSize}`,
                location: { path: pathStr, method },
                expected: this.config.expectedParams.pageSize,
                suggestion: `建议添加 ${this.canonicalParamName.pageSize} 参数`
            });
        }
        else if (params.pageSize !== this.canonicalParamName.pageSize) {
            inconsistencies.push({
                type: 'param_name',
                severity: 'warning',
                message: `分页参数命名不一致: "${params.pageSize}" (期望 "${this.canonicalParamName.pageSize}")`,
                location: { path: pathStr, method, paramName: params.pageSize },
                expected: [this.canonicalParamName.pageSize],
                actual: params.pageSize,
                suggestion: `建议重命名为 ${this.canonicalParamName.pageSize}`
            });
        }
        return inconsistencies;
    }
    checkResponseConsistency(pathStr, method, fields, schema) {
        const inconsistencies = [];
        if (!fields.data) {
            inconsistencies.push({
                type: 'response_missing',
                severity: 'error',
                message: `缺少数据列表字段: ${this.canonicalFieldName.data}`,
                location: { path: pathStr, method },
                expected: this.config.expectedResponseFields.data,
                suggestion: `建议添加 ${this.canonicalFieldName.data} 数组字段`
            });
        }
        else if (fields.data !== this.canonicalFieldName.data) {
            inconsistencies.push({
                type: 'response_name',
                severity: 'warning',
                message: `数据列表字段命名不一致: "${fields.data}" (期望 "${this.canonicalFieldName.data}")`,
                location: { path: pathStr, method, fieldName: fields.data },
                expected: [this.canonicalFieldName.data],
                actual: fields.data,
                suggestion: `建议重命名为 ${this.canonicalFieldName.data}`
            });
        }
        if (!fields.total) {
            inconsistencies.push({
                type: 'response_missing',
                severity: 'error',
                message: `缺少总数字段: ${this.canonicalFieldName.total}`,
                location: { path: pathStr, method },
                expected: this.config.expectedResponseFields.total,
                suggestion: `建议添加 ${this.canonicalFieldName.total} 字段`
            });
        }
        else if (fields.total !== this.canonicalFieldName.total) {
            inconsistencies.push({
                type: 'response_name',
                severity: 'warning',
                message: `总数字段命名不一致: "${fields.total}" (期望 "${this.canonicalFieldName.total}")`,
                location: { path: pathStr, method, fieldName: fields.total },
                expected: [this.canonicalFieldName.total],
                actual: fields.total,
                suggestion: `建议重命名为 ${this.canonicalFieldName.total}`
            });
        }
        if (fields.page && fields.page !== this.canonicalFieldName.page) {
            inconsistencies.push({
                type: 'response_name',
                severity: 'info',
                message: `响应中的页码字段命名不一致: "${fields.page}" (期望 "${this.canonicalFieldName.page}")`,
                location: { path: pathStr, method, fieldName: fields.page },
                expected: [this.canonicalFieldName.page],
                actual: fields.page,
                suggestion: `建议重命名为 ${this.canonicalFieldName.page}`
            });
        }
        if (fields.pageSize && fields.pageSize !== this.canonicalFieldName.pageSize) {
            inconsistencies.push({
                type: 'response_name',
                severity: 'info',
                message: `响应中的页大小字段命名不一致: "${fields.pageSize}" (期望 "${this.canonicalFieldName.pageSize}")`,
                location: { path: pathStr, method, fieldName: fields.pageSize },
                expected: [this.canonicalFieldName.pageSize],
                actual: fields.pageSize,
                suggestion: `建议重命名为 ${this.canonicalFieldName.pageSize}`
            });
        }
        if (schema?.properties && fields.data) {
            const dataField = schema.properties[fields.data];
            if (dataField) {
                const resolvedData = this.parser.resolveSchema(dataField);
                if (resolvedData?.type !== 'array' && !resolvedData?.items) {
                    inconsistencies.push({
                        type: 'structure_issue',
                        severity: 'error',
                        message: `数据字段 "${fields.data}" 不是数组类型`,
                        location: { path: pathStr, method, fieldName: fields.data },
                        suggestion: `确保 ${fields.data} 是数组类型`
                    });
                }
            }
        }
        return inconsistencies;
    }
}
exports.PaginationConsistencyChecker = PaginationConsistencyChecker;
//# sourceMappingURL=checker.js.map