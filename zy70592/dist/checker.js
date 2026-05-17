"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsistencyChecker = void 0;
class ConsistencyChecker {
    constructor(errorResponses, inputFile, totalEndpoints) {
        this.errorResponses = errorResponses;
        this.inputFile = inputFile;
        this.totalEndpoints = totalEndpoints;
    }
    getStatusCodeCategory(statusCode) {
        const code = parseInt(statusCode, 10);
        if (code >= 400 && code < 500)
            return '4xx Client Error';
        if (code >= 500 && code < 600)
            return '5xx Server Error';
        return 'Other';
    }
    groupByStatusCode() {
        const groups = {};
        for (const response of this.errorResponses) {
            const key = response.statusCode;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(response);
        }
        return Object.entries(groups).map(([statusCode, responses]) => {
            const fieldCounts = {};
            for (const resp of responses) {
                for (const field of resp.schemaFields) {
                    fieldCounts[field] = (fieldCounts[field] || 0) + 1;
                }
            }
            const commonFields = Object.entries(fieldCounts)
                .filter(([, count]) => count === responses.length)
                .map(([field]) => field);
            return {
                statusCode,
                category: this.getStatusCodeCategory(statusCode),
                responses,
                commonFields,
                fieldVariations: fieldCounts,
            };
        }).sort((a, b) => parseInt(a.statusCode, 10) - parseInt(b.statusCode, 10));
    }
    checkMissingSchema(responses) {
        const issues = [];
        for (const resp of responses) {
            if (resp.schemaFields.length === 0) {
                issues.push({
                    type: 'missing_error_schema',
                    severity: 'warning',
                    message: `错误响应缺少schema定义`,
                    location: resp.location,
                    details: {
                        suggestion: '为错误响应添加明确的schema定义，包含错误信息字段',
                    },
                });
            }
        }
        return issues;
    }
    checkFieldConsistency(groups) {
        const issues = [];
        for (const group of groups) {
            const responsesWithSchema = group.responses.filter(r => r.schemaFields.length > 0);
            if (responsesWithSchema.length < 2)
                continue;
            const allFields = Object.keys(group.fieldVariations);
            const commonFields = group.commonFields;
            const differentFields = allFields.filter(f => !commonFields.includes(f));
            if (differentFields.length === 0)
                continue;
            for (const resp of responsesWithSchema) {
                for (const field of differentFields) {
                    if (!resp.schemaFields.includes(field)) {
                        issues.push({
                            type: 'field_mismatch',
                            severity: 'error',
                            message: `同状态码字段不一致: 缺少 '${field}'`,
                            location: resp.location,
                            details: {
                                expected: allFields,
                                actual: resp.schemaFields,
                                suggestion: `为 ${resp.method} ${resp.path} 的 ${resp.statusCode} 响应统一使用 ${allFields.join(', ')} 字段`,
                            },
                        });
                    }
                }
            }
        }
        return issues;
    }
    checkCrossStatusCodeConsistency(groups) {
        const issues = [];
        const allFields = {};
        for (const group of groups) {
            for (const field of Object.keys(group.fieldVariations)) {
                if (!allFields[field]) {
                    allFields[field] = [];
                }
                allFields[field].push(group.statusCode);
            }
        }
        const commonErrorFields = Object.entries(allFields)
            .filter(([, statusCodes]) => statusCodes.length >= groups.length * 0.5)
            .map(([field]) => field);
        if (commonErrorFields.length > 0) {
            for (const group of groups) {
                for (const field of commonErrorFields) {
                    if (!group.fieldVariations[field]) {
                        for (const resp of group.responses) {
                            if (!resp.schemaFields.includes(field)) {
                                issues.push({
                                    type: 'status_code_inconsistent',
                                    severity: 'warning',
                                    message: `跨状态码通用字段 '${field}' 缺失`,
                                    location: resp.location,
                                    details: {
                                        expected: commonErrorFields,
                                        actual: resp.schemaFields,
                                        suggestion: `考虑在所有错误响应中统一使用 ${commonErrorFields.join(', ')} 等字段`,
                                    },
                                });
                            }
                        }
                    }
                }
            }
        }
        return issues;
    }
    generateRecommendations(groups) {
        const recommendations = [];
        const allFieldNames = {};
        for (const group of groups) {
            for (const [field, count] of Object.entries(group.fieldVariations)) {
                allFieldNames[field] = (allFieldNames[field] || 0) + count;
            }
        }
        const messageVariants = ['message', 'error', 'errorMessage', 'msg', 'detail'];
        const foundMessageFields = Object.keys(allFieldNames).filter(f => messageVariants.includes(f));
        if (foundMessageFields.length > 1) {
            recommendations.push(`错误消息字段存在多种命名: ${foundMessageFields.join(', ')}。建议统一使用 'message' 或 'error' 其中一个。`);
        }
        const hasCodeField = Object.keys(allFieldNames).some(f => ['code', 'errorCode', 'status'].includes(f));
        if (!hasCodeField && Object.keys(allFieldNames).length > 0) {
            recommendations.push('建议在错误响应中添加错误码字段，便于客户端程序化处理。');
        }
        const groupWithNoSchema = groups.filter(g => g.responses.some(r => r.schemaFields.length === 0));
        if (groupWithNoSchema.length > 0) {
            recommendations.push(`以下状态码部分响应缺少schema: ${groupWithNoSchema.map(g => g.statusCode).join(', ')}。建议为所有错误响应添加明确的schema定义。`);
        }
        return recommendations;
    }
    check() {
        const statusCodeGroups = this.groupByStatusCode();
        const missingSchemaIssues = this.checkMissingSchema(this.errorResponses);
        const fieldConsistencyIssues = this.checkFieldConsistency(statusCodeGroups);
        const crossStatusCodeIssues = this.checkCrossStatusCodeConsistency(statusCodeGroups);
        const allIssues = [...missingSchemaIssues, ...fieldConsistencyIssues, ...crossStatusCodeIssues];
        const errors = allIssues.filter(i => i.severity === 'error').length;
        const warnings = allIssues.filter(i => i.severity === 'warning').length;
        const infos = allIssues.filter(i => i.severity === 'info').length;
        return {
            metadata: {
                checkedAt: new Date().toISOString(),
                inputFile: this.inputFile,
                totalEndpoints: this.totalEndpoints,
                totalErrorResponses: this.errorResponses.length,
            },
            summary: {
                totalIssues: allIssues.length,
                errors,
                warnings,
                infos,
            },
            statusCodeGroups,
            issues: allIssues,
            recommendations: this.generateRecommendations(statusCodeGroups),
        };
    }
}
exports.ConsistencyChecker = ConsistencyChecker;
