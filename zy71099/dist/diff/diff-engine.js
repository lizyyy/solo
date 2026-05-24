"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffEngine = void 0;
exports.createDiffEngine = createDiffEngine;
const types_1 = require("../types");
const request_signer_1 = require("../signer/request-signer");
const masking_engine_1 = require("../masking/masking-engine");
class DiffEngine {
    constructor(config) {
        this.config = config;
        this.signer = new request_signer_1.RequestSigner(config);
        this.maskingEngine = new masking_engine_1.MaskingEngine(config);
    }
    compare(expected, actual) {
        const differences = [];
        const expectedSigs = expected.interactions.map(i => ({
            interaction: i,
            signature: this.signer.sign(i.request)
        }));
        const actualSigs = actual.interactions.map(i => ({
            interaction: i,
            signature: this.signer.sign(i.request)
        }));
        const matches = this.matchInteractions(expectedSigs, actualSigs);
        for (const match of matches) {
            if (match.expected && !match.actual) {
                differences.push(this.createMissingDiff(match.expected));
            }
            else if (match.actual && !match.expected) {
                differences.push(this.createAddedDiff(match.actual));
            }
            else if (match.expected && match.actual) {
                const interactionDiffs = this.compareInteraction(match.expected, match.actual, match.signature);
                differences.push(...interactionDiffs);
            }
        }
        const errors = differences.filter(d => d.severity === 'error').length;
        const warnings = differences.filter(d => d.severity === 'warning').length;
        const changed = differences.filter(d => !['request_missing', 'request_added'].includes(d.type)).length;
        const summary = {
            totalInteractions: {
                expected: expected.interactions.length,
                actual: actual.interactions.length
            },
            matched: matches.filter(m => m.expected && m.actual).length,
            added: matches.filter(m => !m.expected && m.actual).length,
            removed: matches.filter(m => m.expected && !m.actual).length,
            changed,
            errors,
            warnings
        };
        const exitCode = errors > 0 ? types_1.ExitCodes.DIFFERENCES_FOUND : types_1.ExitCodes.SUCCESS;
        return {
            summary,
            differences,
            config: this.config,
            generatedAt: new Date().toISOString(),
            exitCode
        };
    }
    matchInteractions(expected, actual) {
        const matches = [];
        const matchedActualIndices = new Set();
        if (!this.config.ignoreOrder) {
            const maxLen = Math.max(expected.length, actual.length);
            for (let i = 0; i < maxLen; i++) {
                const exp = expected[i];
                const act = actual[i];
                if (exp && act) {
                    matches.push({
                        expected: exp.interaction,
                        actual: act.interaction,
                        similarity: this.calculateSimilarity(exp.signature, act.signature),
                        signature: { expected: exp.signature, actual: act.signature }
                    });
                }
                else if (exp) {
                    matches.push({ expected: exp.interaction, actual: undefined, similarity: 0 });
                }
                else if (act) {
                    matches.push({ expected: undefined, actual: act.interaction, similarity: 0 });
                }
            }
            return matches;
        }
        for (const exp of expected) {
            const actualCandidates = actual
                .filter((_, i) => !matchedActualIndices.has(i))
                .map(a => a.signature);
            const bestMatch = (0, request_signer_1.findBestMatch)(exp.signature, actualCandidates, this.config.tolerance);
            if (bestMatch) {
                const actualIndex = actual.findIndex(a => a.signature.fullHash === bestMatch.signature.fullHash);
                if (actualIndex !== -1) {
                    matchedActualIndices.add(actualIndex);
                    matches.push({
                        expected: exp.interaction,
                        actual: actual[actualIndex].interaction,
                        similarity: bestMatch.score,
                        signature: { expected: exp.signature, actual: bestMatch.signature }
                    });
                    continue;
                }
            }
            matches.push({ expected: exp.interaction, actual: undefined, similarity: 0 });
        }
        for (let i = 0; i < actual.length; i++) {
            if (!matchedActualIndices.has(i)) {
                matches.push({ expected: undefined, actual: actual[i].interaction, similarity: 0 });
            }
        }
        return matches;
    }
    calculateSimilarity(sig1, sig2) {
        let score = 0;
        const total = 5;
        if (sig1.method === sig2.method)
            score++;
        if (sig1.normalizedPath === sig2.normalizedPath)
            score++;
        if (sig1.queryHash === sig2.queryHash)
            score++;
        if (sig1.bodyHash === sig2.bodyHash)
            score++;
        if (sig1.headersHash === sig2.headersHash)
            score++;
        return score / total;
    }
    createMissingDiff(interaction) {
        return {
            interactionId: interaction.id,
            type: 'request_missing',
            severity: 'error',
            message: `请求缺失: ${interaction.request.method} ${interaction.request.uri}`,
            details: [],
            expectedSource: {
                file: interaction.sourceFile || '',
                line: interaction.sourceLine
            }
        };
    }
    createAddedDiff(interaction) {
        return {
            interactionId: interaction.id,
            type: 'request_added',
            severity: 'warning',
            message: `新增请求: ${interaction.request.method} ${interaction.request.uri}`,
            details: [],
            actualSource: {
                file: interaction.sourceFile || '',
                line: interaction.sourceLine
            }
        };
    }
    compareInteraction(expected, actual, signatures) {
        const differences = [];
        if (expected.request.method !== actual.request.method) {
            differences.push({
                interactionId: expected.id,
                type: 'request_method',
                severity: 'error',
                message: `HTTP 方法不匹配: 期望 ${expected.request.method}，实际 ${actual.request.method}`,
                details: [{
                        path: 'request.method',
                        expected: expected.request.method,
                        actual: actual.request.method,
                        type: 'changed'
                    }],
                expectedSource: { file: expected.sourceFile || '', line: expected.sourceLine },
                actualSource: { file: actual.sourceFile || '', line: actual.sourceLine }
            });
        }
        if (signatures?.expected.normalizedPath !== signatures?.actual.normalizedPath) {
            differences.push({
                interactionId: expected.id,
                type: 'request_url',
                severity: 'error',
                message: `URL 不匹配: 期望 ${expected.request.uri}，实际 ${actual.request.uri}`,
                details: [{
                        path: 'request.uri',
                        expected: expected.request.uri,
                        actual: actual.request.uri,
                        type: 'changed'
                    }],
                expectedSource: { file: expected.sourceFile || '', line: expected.sourceLine },
                actualSource: { file: actual.sourceFile || '', line: actual.sourceLine }
            });
        }
        const queryDiff = this.compareQuery(expected.request.query, actual.request.query);
        if (queryDiff.length > 0) {
            differences.push({
                interactionId: expected.id,
                type: 'request_query',
                severity: 'warning',
                message: '查询参数存在差异',
                details: queryDiff,
                expectedSource: { file: expected.sourceFile || '', line: expected.sourceLine },
                actualSource: { file: actual.sourceFile || '', line: actual.sourceLine }
            });
        }
        const headerDiff = this.compareHeaders(expected.request.headers, actual.request.headers, 'request');
        if (headerDiff.length > 0) {
            differences.push({
                interactionId: expected.id,
                type: 'request_header',
                severity: 'warning',
                message: '请求头存在差异',
                details: headerDiff,
                expectedSource: { file: expected.sourceFile || '', line: expected.sourceLine },
                actualSource: { file: actual.sourceFile || '', line: actual.sourceLine }
            });
        }
        const bodyDiff = this.compareBodies(expected.request.body, actual.request.body, 'request.body');
        if (bodyDiff.length > 0) {
            differences.push({
                interactionId: expected.id,
                type: 'request_body',
                severity: 'error',
                message: '请求体存在差异',
                details: bodyDiff,
                expectedSource: { file: expected.sourceFile || '', line: expected.sourceLine },
                actualSource: { file: actual.sourceFile || '', line: actual.sourceLine }
            });
        }
        if (expected.response.status.code !== actual.response.status.code) {
            differences.push({
                interactionId: expected.id,
                type: 'response_status',
                severity: 'error',
                message: `响应状态码不匹配: 期望 ${expected.response.status.code}，实际 ${actual.response.status.code}`,
                details: [{
                        path: 'response.status.code',
                        expected: expected.response.status.code,
                        actual: actual.response.status.code,
                        type: 'changed'
                    }],
                expectedSource: { file: expected.sourceFile || '', line: expected.sourceLine },
                actualSource: { file: actual.sourceFile || '', line: actual.sourceLine }
            });
        }
        const respHeaderDiff = this.compareHeaders(expected.response.headers, actual.response.headers, 'response');
        if (respHeaderDiff.length > 0) {
            differences.push({
                interactionId: expected.id,
                type: 'response_header',
                severity: 'info',
                message: '响应头存在差异',
                details: respHeaderDiff,
                expectedSource: { file: expected.sourceFile || '', line: expected.sourceLine },
                actualSource: { file: actual.sourceFile || '', line: actual.sourceLine }
            });
        }
        const respBodyDiff = this.compareBodies(expected.response.body, actual.response.body, 'response.body');
        if (respBodyDiff.length > 0) {
            const maskingIssues = this.maskingEngine.detectMaskingIssues(expected.response.body, actual.response.body);
            if (maskingIssues.length > 0) {
                differences.push({
                    interactionId: expected.id,
                    type: 'masking_mismatch',
                    severity: 'warning',
                    message: '检测到可能的脱敏问题',
                    details: maskingIssues.map(m => ({
                        path: m.path,
                        expected: m.issue,
                        actual: m.suggestion,
                        type: 'changed'
                    })),
                    expectedSource: { file: expected.sourceFile || '', line: expected.sourceLine },
                    actualSource: { file: actual.sourceFile || '', line: actual.sourceLine }
                });
            }
            differences.push({
                interactionId: expected.id,
                type: 'response_body',
                severity: 'error',
                message: '响应体存在差异',
                details: respBodyDiff,
                expectedSource: { file: expected.sourceFile || '', line: expected.sourceLine },
                actualSource: { file: actual.sourceFile || '', line: actual.sourceLine }
            });
        }
        return differences;
    }
    compareQuery(expected, actual) {
        return this.compareObjects(expected || {}, actual || {}, 'query');
    }
    compareHeaders(expected, actual, prefix) {
        if (!this.config.normalizeHeaders) {
            return [];
        }
        const significantHeaders = ['content-type', 'content-length'];
        const filteredExpected = {};
        const filteredActual = {};
        for (const header of significantHeaders) {
            if (expected?.[header])
                filteredExpected[header] = expected[header];
            if (actual?.[header])
                filteredActual[header] = actual[header];
        }
        return this.compareObjects(filteredExpected, filteredActual, `${prefix}.headers`);
    }
    compareBodies(expected, actual, prefix) {
        if (expected === undefined && actual === undefined) {
            return [];
        }
        if (expected === undefined || actual === undefined) {
            return [{
                    path: prefix,
                    expected,
                    actual,
                    type: expected === undefined ? 'added' : 'removed'
                }];
        }
        if (typeof expected === 'string' && typeof actual === 'string') {
            if (expected !== actual) {
                return [{
                        path: prefix,
                        expected,
                        actual,
                        type: 'changed'
                    }];
            }
            return [];
        }
        if (typeof expected === 'object' && typeof actual === 'object') {
            return this.compareObjects(expected, actual, prefix);
        }
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            return [{
                    path: prefix,
                    expected,
                    actual,
                    type: 'changed'
                }];
        }
        return [];
    }
    compareObjects(expected, actual, prefix) {
        const details = [];
        if (Array.isArray(expected) && Array.isArray(actual)) {
            const maxLen = Math.max(expected.length, actual.length);
            if (this.config.ignoreOrder) {
                const sortedExpected = this.sortArray(expected);
                const sortedActual = this.sortArray(actual);
                for (let i = 0; i < maxLen; i++) {
                    const path = `${prefix}[${i}]`;
                    if (i >= sortedExpected.length) {
                        details.push({ path, expected: undefined, actual: sortedActual[i], type: 'added' });
                    }
                    else if (i >= sortedActual.length) {
                        details.push({ path, expected: sortedExpected[i], actual: undefined, type: 'removed' });
                    }
                    else if (!this.deepEqual(sortedExpected[i], sortedActual[i])) {
                        details.push(...this.compareBodies(sortedExpected[i], sortedActual[i], path));
                    }
                }
            }
            else {
                for (let i = 0; i < maxLen; i++) {
                    const path = `${prefix}[${i}]`;
                    if (i >= expected.length) {
                        details.push({ path, expected: undefined, actual: actual[i], type: 'added' });
                    }
                    else if (i >= actual.length) {
                        details.push({ path, expected: expected[i], actual: undefined, type: 'removed' });
                    }
                    else if (!this.deepEqual(expected[i], actual[i])) {
                        details.push(...this.compareBodies(expected[i], actual[i], path));
                    }
                }
            }
            return details;
        }
        const expectedKeys = Object.keys(expected || {});
        const actualKeys = Object.keys(actual || {});
        const allKeys = new Set([...expectedKeys, ...actualKeys]);
        for (const key of allKeys) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (this.shouldIgnoreField(path)) {
                continue;
            }
            const expVal = expected?.[key];
            const actVal = actual?.[key];
            if (!(key in (expected || {}))) {
                details.push({ path, expected: undefined, actual: actVal, type: 'added' });
            }
            else if (!(key in (actual || {}))) {
                details.push({ path, expected: expVal, actual: undefined, type: 'removed' });
            }
            else if (!this.deepEqual(expVal, actVal)) {
                details.push(...this.compareBodies(expVal, actVal, path));
            }
        }
        return details;
    }
    sortArray(arr) {
        return [...arr].sort((a, b) => {
            const strA = typeof a === 'string' ? a : JSON.stringify(a);
            const strB = typeof b === 'string' ? b : JSON.stringify(b);
            return strA.localeCompare(strB);
        });
    }
    deepEqual(a, b) {
        if (a === b)
            return true;
        if (typeof a !== typeof b)
            return false;
        if (typeof a !== 'object' || a === null || b === null)
            return false;
        if (Array.isArray(a) !== Array.isArray(b))
            return false;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length)
                return false;
            for (let i = 0; i < a.length; i++) {
                if (!this.deepEqual(a[i], b[i]))
                    return false;
            }
            return true;
        }
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length)
            return false;
        for (const key of keysA) {
            if (!this.deepEqual(a[key], b[key]))
                return false;
        }
        return true;
    }
    shouldIgnoreField(path) {
        for (const pattern of this.config.ignoreFields) {
            if (this.matchPattern(path, pattern)) {
                return true;
            }
        }
        return false;
    }
    matchPattern(path, pattern) {
        if (path === pattern)
            return true;
        if (path.endsWith('.' + pattern) || path.endsWith('[' + pattern)) {
            return true;
        }
        const flexiblePattern = pattern
            .replace(/^(request\.|response\.)?/, '(request\\.|response\\.)?');
        const regexPattern = flexiblePattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        try {
            return new RegExp(`^${regexPattern}$`).test(path);
        }
        catch {
            return false;
        }
    }
}
exports.DiffEngine = DiffEngine;
function createDiffEngine(config) {
    return new DiffEngine(config);
}
//# sourceMappingURL=diff-engine.js.map