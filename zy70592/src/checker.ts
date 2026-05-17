import { ErrorResponseInfo, StatusCodeGroup, ConsistencyIssue, CheckResult } from './types';

export class ConsistencyChecker {
  private errorResponses: ErrorResponseInfo[];
  private inputFile: string;
  private totalEndpoints: number;

  constructor(errorResponses: ErrorResponseInfo[], inputFile: string, totalEndpoints: number) {
    this.errorResponses = errorResponses;
    this.inputFile = inputFile;
    this.totalEndpoints = totalEndpoints;
  }

  private getStatusCodeCategory(statusCode: string): string {
    const code = parseInt(statusCode, 10);
    if (code >= 400 && code < 500) return '4xx Client Error';
    if (code >= 500 && code < 600) return '5xx Server Error';
    return 'Other';
  }

  public groupByStatusCode(): StatusCodeGroup[] {
    const groups: Record<string, ErrorResponseInfo[]> = {};

    for (const response of this.errorResponses) {
      const key = response.statusCode;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(response);
    }

    return Object.entries(groups).map(([statusCode, responses]) => {
      const fieldCounts: Record<string, number> = {};
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

  private checkMissingSchema(responses: ErrorResponseInfo[]): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

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

  private checkFieldConsistency(groups: StatusCodeGroup[]): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    for (const group of groups) {
      if (group.responses.length < 2) continue;

      const allFields = Object.keys(group.fieldVariations);
      const majorityThreshold = Math.ceil(group.responses.length * 0.7);

      for (const [field, count] of Object.entries(group.fieldVariations)) {
        if (count < group.responses.length && count >= majorityThreshold) {
          const missingIn = group.responses.filter(r => !r.schemaFields.includes(field));
          for (const resp of missingIn) {
            issues.push({
              type: 'field_mismatch',
              severity: 'error',
              message: `字段 '${field}' 在同一状态码的响应中缺失`,
              location: resp.location,
              details: {
                expected: [field],
                actual: resp.schemaFields,
                suggestion: `为 ${resp.method} ${resp.path} 的 ${resp.statusCode} 响应添加 '${field}' 字段`,
              },
            });
          }
        }
      }
    }

    return issues;
  }

  private checkCrossStatusCodeConsistency(groups: StatusCodeGroup[]): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const allFields: Record<string, string[]> = {};

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

  private generateRecommendations(groups: StatusCodeGroup[]): string[] {
    const recommendations: string[] = [];

    const allFieldNames: Record<string, number> = {};
    for (const group of groups) {
      for (const [field, count] of Object.entries(group.fieldVariations)) {
        allFieldNames[field] = (allFieldNames[field] || 0) + count;
      }
    }

    const messageVariants = ['message', 'error', 'errorMessage', 'msg', 'detail'];
    const foundMessageFields = Object.keys(allFieldNames).filter(f => 
      messageVariants.includes(f)
    );

    if (foundMessageFields.length > 1) {
      recommendations.push(
        `错误消息字段存在多种命名: ${foundMessageFields.join(', ')}。建议统一使用 'message' 或 'error' 其中一个。`
      );
    }

    const hasCodeField = Object.keys(allFieldNames).some(f => 
      ['code', 'errorCode', 'status'].includes(f)
    );
    if (!hasCodeField && Object.keys(allFieldNames).length > 0) {
      recommendations.push('建议在错误响应中添加错误码字段，便于客户端程序化处理。');
    }

    const groupWithNoSchema = groups.filter(g => 
      g.responses.some(r => r.schemaFields.length === 0)
    );
    if (groupWithNoSchema.length > 0) {
      recommendations.push(
        `以下状态码部分响应缺少schema: ${groupWithNoSchema.map(g => g.statusCode).join(', ')}。建议为所有错误响应添加明确的schema定义。`
      );
    }

    return recommendations;
  }

  public check(): CheckResult {
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
