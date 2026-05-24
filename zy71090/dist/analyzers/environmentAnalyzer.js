"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeEnvironments = analyzeEnvironments;
exports.getRecordsByEnvironment = getRecordsByEnvironment;
exports.getWildcardRecords = getWildcardRecords;
exports.getAliasRecords = getAliasRecords;
exports.getEnvironmentCounts = getEnvironmentCounts;
exports.expandWildcardRecord = expandWildcardRecord;
const fs_1 = require("fs");
const default_1 = require("../config/default");
function analyzeEnvironments(zoneData, targetEnvironments, configPath) {
    const envConfigs = loadEnvConfig(configPath);
    const filteredConfigs = envConfigs.filter(e => targetEnvironments.includes(e.name));
    return zoneData.records.map(record => {
        const environments = detectEnvironments(record.name, filteredConfigs);
        const isWildcard = record.name.startsWith('*');
        const hasAlias = checkForAlias(record, zoneData);
        return {
            record,
            environments,
            isWildcard,
            hasAlias
        };
    });
}
function loadEnvConfig(configPath) {
    if (!configPath) {
        return default_1.DEFAULT_ENVIRONMENTS;
    }
    try {
        const content = (0, fs_1.readFileSync)(configPath, 'utf-8');
        const config = JSON.parse(content);
        if (Array.isArray(config)) {
            return config;
        }
        return default_1.DEFAULT_ENVIRONMENTS;
    }
    catch {
        return default_1.DEFAULT_ENVIRONMENTS;
    }
}
function detectEnvironments(domain, envConfigs) {
    const environments = [];
    const domainLower = domain.toLowerCase();
    for (const env of envConfigs) {
        for (const pattern of env.patterns) {
            if (matchesPattern(domainLower, pattern)) {
                if (!environments.includes(env.name)) {
                    environments.push(env.name);
                }
                break;
            }
        }
    }
    if (environments.length === 0) {
        environments.push('unknown');
    }
    return environments;
}
function matchesPattern(domain, pattern) {
    if (!pattern)
        return true;
    const patternLower = pattern.toLowerCase();
    if (domain === patternLower) {
        return true;
    }
    if (domain.startsWith(patternLower + '.') ||
        domain.includes('.' + patternLower + '.') ||
        domain.endsWith('.' + patternLower)) {
        return true;
    }
    if (domain.includes('-' + patternLower + '-') ||
        domain.startsWith(patternLower + '-') ||
        domain.endsWith('-' + patternLower)) {
        return true;
    }
    return false;
}
function checkForAlias(record, zoneData) {
    if (record.type !== 'CNAME') {
        return false;
    }
    const cnameTargets = zoneData.records
        .filter(r => r.type === 'CNAME')
        .map(r => r.value);
    return cnameTargets.includes(record.name);
}
function getRecordsByEnvironment(analysis, environment) {
    return analysis.filter(a => a.environments.includes(environment));
}
function getWildcardRecords(analysis) {
    return analysis.filter(a => a.isWildcard);
}
function getAliasRecords(analysis) {
    return analysis.filter(a => a.hasAlias);
}
function getEnvironmentCounts(analysis) {
    const counts = {};
    for (const item of analysis) {
        for (const env of item.environments) {
            counts[env] = (counts[env] || 0) + 1;
        }
    }
    return counts;
}
function expandWildcardRecord(wildcardRecord, allRecords) {
    if (!wildcardRecord.isWildcard) {
        return [];
    }
    const wildcardPattern = wildcardRecord.record.name.replace('*', '');
    const matchingRecords = [];
    for (const record of allRecords) {
        if (record.isWildcard)
            continue;
        if (record.record.name.includes(wildcardPattern)) {
            matchingRecords.push(record.record.name);
        }
    }
    return matchingRecords;
}
//# sourceMappingURL=environmentAnalyzer.js.map