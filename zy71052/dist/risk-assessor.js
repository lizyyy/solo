"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRiskLevel = calculateRiskLevel;
exports.getRiskLevelLabel = getRiskLevelLabel;
exports.getRiskLevelEmoji = getRiskLevelEmoji;
exports.sortByRiskLevel = sortByRiskLevel;
const timezone_utils_1 = require("./timezone-utils");
function calculateRiskLevel(clientUsage, routes, timezone, isInternalClient = false) {
    const reasons = [];
    let score = 0;
    const requestCount = clientUsage.totalRequests;
    if (requestCount >= 10000) {
        score += 40;
        reasons.push(`请求量极高 (${requestCount.toLocaleString()})`);
    }
    else if (requestCount >= 1000) {
        score += 25;
        reasons.push(`请求量较高 (${requestCount.toLocaleString()})`);
    }
    else if (requestCount >= 100) {
        score += 10;
        reasons.push(`有一定请求量 (${requestCount.toLocaleString()})`);
    }
    else if (requestCount > 0) {
        score += 5;
        reasons.push(`存在请求 (${requestCount.toLocaleString()})`);
    }
    const deprecationDates = routes
        .filter(r => r.deprecationDate)
        .map(r => (0, timezone_utils_1.getDeprecationStatus)(r.deprecationDate, timezone));
    if (deprecationDates.length > 0) {
        const minDays = Math.min(...deprecationDates.map(d => d.daysUntil));
        const isExpired = deprecationDates.some(d => d.isExpired);
        if (isExpired) {
            score += 35;
            reasons.push('部分退役日期已过期');
        }
        else if (minDays <= 7) {
            score += 25;
            reasons.push(`距离最近退役日期仅 ${minDays} 天`);
        }
        else if (minDays <= 30) {
            score += 15;
            reasons.push(`距离最近退役日期还有 ${minDays} 天`);
        }
        else if (minDays <= 90) {
            score += 5;
            reasons.push(`距离最近退役日期还有 ${minDays} 天`);
        }
    }
    const activeVersions = Object.keys(clientUsage.versions).length;
    if (activeVersions >= 5) {
        score += 15;
        reasons.push(`涉及 ${activeVersions} 个版本，升级复杂度高`);
    }
    else if (activeVersions >= 3) {
        score += 8;
        reasons.push(`涉及 ${activeVersions} 个版本`);
    }
    const routeCount = clientUsage.routes.length;
    if (routeCount >= 10) {
        score += 15;
        reasons.push(`使用 ${routeCount} 个退役接口，迁移工作量大`);
    }
    else if (routeCount >= 5) {
        score += 8;
        reasons.push(`使用 ${routeCount} 个退役接口`);
    }
    else if (routeCount >= 2) {
        score += 4;
        reasons.push(`使用 ${routeCount} 个退役接口`);
    }
    if (!isInternalClient) {
        score += 10;
        reasons.push('外部客户端，沟通协调成本高');
    }
    if (clientUsage.routes.length > 0) {
        const lastUsedStr = clientUsage.routes[0].lastUsed;
        const lastUsed = new Date(lastUsedStr);
        const daysSinceLastUse = Math.floor((Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastUse <= 1) {
            score += 10;
            reasons.push('最近24小时内仍有活跃请求');
        }
        else if (daysSinceLastUse <= 7) {
            score += 5;
            reasons.push('最近一周内有请求');
        }
    }
    let level;
    if (score >= 70) {
        level = 'critical';
    }
    else if (score >= 45) {
        level = 'high';
    }
    else if (score >= 25) {
        level = 'medium';
    }
    else if (score > 0) {
        level = 'low';
    }
    else {
        level = 'none';
    }
    return {
        level,
        score,
        factors: {
            totalRequests: requestCount,
            daysUntilDeprecation: deprecationDates.length > 0
                ? Math.min(...deprecationDates.map(d => d.daysUntil))
                : Infinity,
            isDeprecationExpired: deprecationDates.some(d => d.isExpired),
            activeVersions,
            routeCount,
            isInternalClient,
            lastUsedDays: clientUsage.routes.length > 0
                ? Math.floor((Date.now() - new Date(clientUsage.routes[0].lastUsed).getTime()) / (1000 * 60 * 60 * 24))
                : -1,
        },
        reasons,
    };
}
function getRiskLevelLabel(level) {
    const labels = {
        critical: '严重',
        high: '高',
        medium: '中',
        low: '低',
        none: '无',
    };
    return labels[level];
}
function getRiskLevelEmoji(level) {
    const emojis = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
        none: '⚪',
    };
    return emojis[level];
}
function sortByRiskLevel(items, getLevel) {
    const priority = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        none: 4,
    };
    return [...items].sort((a, b) => priority[getLevel(a)] - priority[getLevel(b)]);
}
//# sourceMappingURL=risk-assessor.js.map