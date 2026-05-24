"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isExceptionExpired = isExceptionExpired;
exports.matchesException = matchesException;
exports.applyExceptions = applyExceptions;
exports.validateException = validateException;
exports.getExceptionSummary = getExceptionSummary;
function isExceptionExpired(exception) {
    if (!exception.expiresAt) {
        return false;
    }
    const expireDate = new Date(exception.expiresAt);
    const now = new Date();
    return expireDate < now;
}
function matchesException(finding, exception, environment) {
    if (exception.environment && exception.environment !== environment) {
        return false;
    }
    if (exception.ruleId && exception.ruleId !== finding.ruleId) {
        return false;
    }
    if (exception.path) {
        const pathPattern = exception.path.replace(/\*/g, '.*').replace(/\?/g, '.');
        const pathRegex = new RegExp(`^${pathPattern}$`);
        if (!pathRegex.test(finding.location.path)) {
            return false;
        }
    }
    if (exception.value) {
        const valuePattern = exception.value.replace(/\*/g, '.*').replace(/\?/g, '.');
        const valueRegex = new RegExp(valuePattern, 'i');
        if (!valueRegex.test(finding.matchedValue)) {
            return false;
        }
    }
    return true;
}
function applyExceptions(findings, exceptions, environment) {
    let exceptedCount = 0;
    let expiredCount = 0;
    const processedFindings = findings.map(finding => {
        for (const exception of exceptions) {
            if (matchesException(finding, exception, environment)) {
                const isExpired = isExceptionExpired(exception);
                if (!isExpired) {
                    exceptedCount++;
                }
                else {
                    expiredCount++;
                }
                return {
                    ...finding,
                    excepted: !isExpired,
                    exception: exception,
                    exceptionExpired: isExpired
                };
            }
        }
        return finding;
    });
    return {
        findings: processedFindings,
        exceptedCount,
        expiredCount
    };
}
function validateException(exception) {
    const errors = [];
    if (!exception.id) {
        errors.push('例外项缺少 id 字段');
    }
    if (!exception.reason) {
        errors.push(`例外项 ${exception.id} 缺少 reason 字段，必须说明例外原因`);
    }
    if (!exception.createdBy) {
        errors.push(`例外项 ${exception.id} 缺少 createdBy 字段，必须记录创建人`);
    }
    if (!exception.createdAt) {
        errors.push(`例外项 ${exception.id} 缺少 createdAt 字段`);
    }
    if (!exception.path && !exception.value && !exception.ruleId) {
        errors.push(`例外项 ${exception.id} 必须至少指定 path、value 或 ruleId 之一`);
    }
    if (exception.expiresAt) {
        const expireDate = new Date(exception.expiresAt);
        if (isNaN(expireDate.getTime())) {
            errors.push(`例外项 ${exception.id} 的 expiresAt 格式无效: ${exception.expiresAt}`);
        }
    }
    return errors;
}
function getExceptionSummary(exception) {
    const parts = [];
    if (exception.ruleId)
        parts.push(`规则: ${exception.ruleId}`);
    if (exception.path)
        parts.push(`路径: ${exception.path}`);
    if (exception.environment)
        parts.push(`环境: ${exception.environment}`);
    if (exception.expiresAt) {
        const expired = isExceptionExpired(exception);
        parts.push(`过期: ${exception.expiresAt}${expired ? ' [已过期]' : ''}`);
    }
    return parts.join(' | ');
}
