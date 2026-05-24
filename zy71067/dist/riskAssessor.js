"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessRisk = assessRisk;
exports.getRiskLevelColor = getRiskLevelColor;
exports.getRiskLevelEmoji = getRiskLevelEmoji;
exports.getRiskLevelLabel = getRiskLevelLabel;
exports.sortResultsByRisk = sortResultsByRisk;
exports.filterResultsByRisk = filterResultsByRisk;
function assessRisk(widthResult, maxWidth, placeholderIssues, maxChars) {
    const widthOverflow = Math.max(0, widthResult.charWidth - maxWidth);
    const charOverflow = maxChars ? Math.max(0, widthResult.charCount - maxChars) : 0;
    const widthOverflowPercent = maxWidth > 0 ? (widthOverflow / maxWidth) * 100 : 0;
    const reasons = [];
    let level = 'safe';
    if (placeholderIssues.length > 0) {
        const missingCount = placeholderIssues.filter(i => i.type === 'missing').length;
        if (missingCount > 0) {
            level = 'critical';
            reasons.push(`缺失 ${missingCount} 个占位符，可能导致运行时错误`);
        }
        else {
            level = level === 'safe' ? 'warning' : level;
            reasons.push(`存在 ${placeholderIssues.length} 个占位符问题`);
        }
    }
    if (widthOverflow > 0) {
        if (widthOverflowPercent >= 30) {
            level = 'critical';
            reasons.push(`严重溢出: 超出限制 ${widthOverflowPercent.toFixed(1)}% (${widthResult.charWidth}/${maxWidth})`);
        }
        else if (widthOverflowPercent >= 15) {
            level = level === 'critical' ? 'critical' : 'warning';
            reasons.push(`明显溢出: 超出限制 ${widthOverflowPercent.toFixed(1)}%`);
        }
        else if (widthOverflowPercent >= 5) {
            level = level === 'safe' ? 'info' : level;
            reasons.push(`轻微溢出: 超出限制 ${widthOverflowPercent.toFixed(1)}%`);
        }
        else {
            level = level === 'safe' ? 'info' : level;
            reasons.push(`接近限制: 超出限制 ${widthOverflow} 单位`);
        }
    }
    if (charOverflow > 0) {
        level = level === 'safe' ? 'info' : level;
        reasons.push(`字符数超出: ${widthResult.charCount}/${maxChars}`);
    }
    if (level === 'safe') {
        return {
            level: 'safe',
            explanation: `检测通过 - 宽度: ${widthResult.charWidth}/${maxWidth} 单位, 字符数: ${widthResult.charCount}${maxChars ? '/' + maxChars : ''}`,
        };
    }
    return {
        level,
        explanation: reasons.join('; '),
    };
}
function getRiskLevelColor(level) {
    switch (level) {
        case 'critical': return 'red';
        case 'warning': return 'yellow';
        case 'info': return 'blue';
        case 'safe': return 'green';
        default: return 'white';
    }
}
function getRiskLevelEmoji(level) {
    switch (level) {
        case 'critical': return '🔴';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        case 'safe': return '✅';
        default: return '';
    }
}
function getRiskLevelLabel(level) {
    switch (level) {
        case 'critical': return '严重';
        case 'warning': return '警告';
        case 'info': return '提示';
        case 'safe': return '安全';
        default: return '未知';
    }
}
function sortResultsByRisk(results) {
    const riskOrder = {
        critical: 0,
        warning: 1,
        info: 2,
        safe: 3,
    };
    return [...results].sort((a, b) => {
        const orderDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        if (orderDiff !== 0)
            return orderDiff;
        return b.widthOverflow - a.widthOverflow;
    });
}
function filterResultsByRisk(results, minLevel) {
    const riskLevels = ['critical', 'warning', 'info', 'safe'];
    const minIndex = riskLevels.indexOf(minLevel);
    return results.filter(r => {
        const resultIndex = riskLevels.indexOf(r.riskLevel);
        return resultIndex <= minIndex;
    });
}
//# sourceMappingURL=riskAssessor.js.map