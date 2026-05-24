"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDefaultValueInversion = detectDefaultValueInversion;
exports.detectDynamicNameUsage = detectDynamicNameUsage;
exports.calculateRiskLevel = calculateRiskLevel;
exports.generateRecommendation = generateRecommendation;
exports.canRemoveFlag = canRemoveFlag;
exports.analyzeFlag = analyzeFlag;
exports.analyzeAllFlags = analyzeAllFlags;
const constants_1 = require("./constants");
function detectDefaultValueInversion(flag, matches, assumedDefault) {
    const effectiveDefault = assumedDefault !== undefined ? assumedDefault : flag.defaultValue;
    const negatedCount = matches.filter(m => m.isNegated).length;
    const totalCount = matches.length;
    if (totalCount === 0) {
        return { inverted: false, reason: 'No matches found' };
    }
    const negatedRatio = negatedCount / totalCount;
    if (effectiveDefault === true && negatedRatio > 0.7) {
        return {
            inverted: true,
            reason: `默认值为 true，但 ${(negatedRatio * 100).toFixed(0)}% 的使用是否定形式（!flag），建议反转逻辑清理`
        };
    }
    if (effectiveDefault === false && negatedRatio < 0.3 && totalCount > 3) {
        const positiveCount = totalCount - negatedCount;
        const positiveRatio = positiveCount / totalCount;
        if (positiveRatio > 0.7) {
            return {
                inverted: true,
                reason: `默认值为 false，但 ${(positiveRatio * 100).toFixed(0)}% 的使用是肯定形式，可能存在默认值反转`
            };
        }
    }
    return { inverted: false, reason: 'Usage patterns align with default value' };
}
function detectDynamicNameUsage(flag, matches) {
    return matches.some(m => m.matchType === 'dynamic');
}
function calculateRiskLevel(flag, matches, analysis) {
    const reasons = [];
    let riskScore = 0;
    if (flag.status === 'active') {
        riskScore += 3;
        reasons.push(constants_1.RISK_REASONS.ACTIVE_EXPERIMENT);
    }
    if (flag.status === 'unknown') {
        riskScore += 1;
        reasons.push(constants_1.RISK_REASONS.UNKNOWN_STATUS);
    }
    if (analysis.defaultValueInverted) {
        riskScore += 2;
        reasons.push(constants_1.RISK_REASONS.DEFAULT_VALUE_INVERTED);
    }
    if (analysis.dynamicNameUsed) {
        riskScore += 3;
        reasons.push(constants_1.RISK_REASONS.DYNAMIC_NAME);
    }
    if (matches.length > 20) {
        riskScore += 2;
        reasons.push(`${constants_1.RISK_REASONS.HIGH_OCCURRENCE} (${matches.length}次)`);
    }
    else if (matches.length > 10) {
        riskScore += 1;
    }
    const uniqueFiles = new Set(matches.map(m => m.filePath)).size;
    if (uniqueFiles > 5) {
        riskScore += 1;
        reasons.push(`${constants_1.RISK_REASONS.MULTIPLE_FILES} (${uniqueFiles}个文件)`);
    }
    const hasNegated = matches.some(m => m.isNegated);
    const hasPositive = matches.some(m => !m.isNegated);
    if (hasNegated && hasPositive && matches.length > 5) {
        riskScore += 1;
        reasons.push(constants_1.RISK_REASONS.NEGATED_USAGE);
    }
    let level;
    if (riskScore >= 6) {
        level = 'critical';
    }
    else if (riskScore >= 4) {
        level = 'high';
    }
    else if (riskScore >= 2) {
        level = 'medium';
    }
    else if (riskScore >= 1) {
        level = 'low';
    }
    else {
        level = 'safe';
    }
    return { level, reasons };
}
function generateRecommendation(flag, riskLevel, matchCount) {
    if (matchCount === 0) {
        return '代码中未找到使用，可以安全删除 flag 定义';
    }
    if (flag.status === 'active') {
        return '实验仍在进行中，建议等待实验结束后再清理';
    }
    if (flag.status === 'archived') {
        return '实验已归档，建议优先清理此 flag';
    }
    switch (riskLevel) {
        case 'safe':
            return `可以安全删除，共 ${matchCount} 处引用`;
        case 'low':
            return `建议删除，改动量较小 (${matchCount} 处)`;
        case 'medium':
            return `需要谨慎操作，涉及 ${matchCount} 处引用，请仔细核对后删除`;
        case 'high':
            return '高风险操作，建议先确认实验状态，进行代码审查后再清理';
        case 'critical':
            return '极高风险！存在动态 flag 或逻辑反转，建议手动分析后再决定';
        default:
            return '请人工确认后再操作';
    }
}
function canRemoveFlag(flag, riskLevel, matchCount) {
    if (matchCount === 0)
        return true;
    if (flag.status === 'active')
        return false;
    if (riskLevel === 'critical')
        return false;
    if (riskLevel === 'high' && flag.status !== 'completed' && flag.status !== 'archived')
        return false;
    return true;
}
function analyzeFlag(flag, allMatches, options) {
    const matches = allMatches.filter(m => m.flagName === flag.name);
    const uniqueFiles = new Set(matches.map(m => m.filePath));
    const { inverted: defaultValueInverted } = detectDefaultValueInversion(flag, matches, options.defaultAssumedValue);
    const dynamicNameUsed = detectDynamicNameUsage(flag, matches);
    const { level: riskLevel, reasons: riskReasons } = calculateRiskLevel(flag, matches, {
        defaultValueInverted,
        dynamicNameUsed,
    });
    const canRemove = canRemoveFlag(flag, riskLevel, matches.length);
    const recommendation = generateRecommendation(flag, riskLevel, matches.length);
    return {
        flag,
        matches,
        totalOccurrences: matches.length,
        fileCount: uniqueFiles.size,
        canRemove,
        riskLevel,
        riskReasons,
        recommendation,
        defaultValueInverted,
        dynamicNameUsed,
    };
}
function analyzeAllFlags(flagDefinitions, matches, options, filesScanned, errors, startTime) {
    const flagAnalyses = flagDefinitions.map(flag => analyzeFlag(flag, matches, options));
    const flagsCanRemove = flagAnalyses.filter(f => f.canRemove).length;
    const flagsWithRisk = flagAnalyses.filter(f => f.riskLevel === 'high' || f.riskLevel === 'critical').length;
    const fileMatchCounts = {};
    matches.forEach(m => {
        fileMatchCounts[m.filePath] = (fileMatchCounts[m.filePath] || 0) + 1;
    });
    const files = Object.entries(fileMatchCounts).map(([filePath, matchCount]) => ({
        path: filePath,
        language: flagAnalyses.find(a => a.matches.some(m => m.filePath === filePath))?.matches[0]?.language || 'other',
        matchCount,
    }));
    return {
        summary: {
            totalFlags: flagDefinitions.length,
            flagsScanned: flagDefinitions.length,
            flagsCanRemove,
            flagsWithRisk,
            totalMatches: matches.length,
            filesScanned: filesScanned.length,
            scanDuration: Date.now() - startTime,
        },
        flags: flagAnalyses.sort((a, b) => constants_1.RISK_LEVEL_WEIGHTS[b.riskLevel] - constants_1.RISK_LEVEL_WEIGHTS[a.riskLevel]),
        files: files.sort((a, b) => b.matchCount - a.matchCount),
        errors,
        metadata: {
            scanDate: new Date().toISOString(),
            version: constants_1.VERSION,
            options,
        },
    };
}
//# sourceMappingURL=analyzer.js.map