"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFailure = normalizeFailure;
exports.calculateSimilarity = calculateSimilarity;
const crypto_1 = require("crypto");
function normalizeErrorMessage(message) {
    let normalized = message;
    normalized = normalized.replace(/\d+\.\d+\.\d+\.\d+/g, '[IP]');
    normalized = normalized.replace(/https?:\/\/[^\s]+/g, '[URL]');
    normalized = normalized.replace(/[a-f0-9]{32}|[a-f0-9]{64}/gi, '[HASH]');
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '[TIMESTAMP]');
    normalized = normalized.replace(/expected\s+['"].*?['"]\s+to\s+.*?\s+['"].*?['"]/gi, 'expected [VALUE] to [CONDITION]');
    normalized = normalized.replace(/expected\s+.*?\s+to\s+/gi, 'expected [VALUE] to ');
    return normalized;
}
function normalizeStackTrace(stack) {
    if (!stack)
        return '';
    const lines = stack.split('\n');
    const normalizedLines = [];
    for (const line of lines) {
        let normalized = line;
        normalized = normalized.replace(/:\d+:\d+/g, ':[LINE:COL]');
        normalized = normalized.replace(/\d+/g, '[NUM]');
        normalized = normalized.replace(/<anonymous>/g, '[ANON]');
        normalized = normalized.replace(/at\s+(async\s+)?/g, 'at ');
        if (!normalized.includes('node_modules') &&
            !normalized.includes('internal/') &&
            !normalized.includes('timers.js')) {
            normalizedLines.push(normalized);
        }
    }
    return normalizedLines.join('\n');
}
function extractFeatures(failure) {
    const features = [];
    const errorType = failure.errorMessage.split(':')[0];
    if (errorType) {
        features.push(`type:${errorType}`);
    }
    const testParts = failure.testName.split('.');
    if (testParts.length > 1) {
        features.push(`suite:${testParts[0]}`);
    }
    const keywords = ['timeout', 'network', 'connection', 'assert', 'expect', 'null', 'undefined', 'permission', '404', '500'];
    for (const kw of keywords) {
        if (failure.errorMessage.toLowerCase().includes(kw)) {
            features.push(`kw:${kw}`);
        }
    }
    const stackLines = failure.stackTrace.split('\n');
    for (const line of stackLines) {
        const match = line.match(/\(([^:)]+)/);
        if (match && match[1]) {
            const file = match[1].split('/').pop();
            if (file && !file.includes('node_modules')) {
                features.push(`file:${file}`);
                break;
            }
        }
    }
    return features;
}
function generateFingerprint(normalizedError, normalizedStack, features) {
    const keyData = normalizedError.slice(0, 200) + normalizedStack.slice(0, 300) + features.join('|');
    return (0, crypto_1.createHash)('sha256').update(keyData).digest('hex').slice(0, 16);
}
function normalizeFailure(failure) {
    const normalizedError = normalizeErrorMessage(failure.errorMessage);
    const normalizedStack = normalizeStackTrace(failure.stackTrace);
    const features = extractFeatures(failure);
    const fingerprint = generateFingerprint(normalizedError, normalizedStack, features);
    return {
        original: failure,
        normalizedError,
        normalizedStack,
        features,
        fingerprint
    };
}
function calculateSimilarity(a, b) {
    if (a.fingerprint === b.fingerprint)
        return 1.0;
    const commonFeatures = a.features.filter(f => b.features.includes(f)).length;
    const totalFeatures = new Set([...a.features, ...b.features]).size;
    const featureSimilarity = totalFeatures > 0 ? commonFeatures / totalFeatures : 0;
    const errorSimilarity = stringSimilarity(a.normalizedError, b.normalizedError);
    const stackSimilarity = stringSimilarity(a.normalizedStack, b.normalizedStack);
    return (featureSimilarity * 0.4) + (errorSimilarity * 0.35) + (stackSimilarity * 0.25);
}
function stringSimilarity(a, b) {
    if (a === b)
        return 1.0;
    if (!a || !b)
        return 0;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0)
        return 1.0;
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[b.length][a.length];
}
