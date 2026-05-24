"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTTL = analyzeTTL;
exports.getTTLDistribution = getTTLDistribution;
exports.getRecordsNeedingAdjustment = getRecordsNeedingAdjustment;
exports.getRecordsByTier = getRecordsByTier;
const fs_1 = require("fs");
const default_1 = require("../config/default");
function analyzeTTL(zoneData, options) {
    const tiers = loadTTLConfig(options.ttlConfig);
    const migrationWindowTTL = parseMigrationWindow(options.migrationWindow);
    return zoneData.records.map(record => {
        const tierConfig = getTierForTTL(record.ttl, tiers);
        const needsAdjustment = checkNeedsAdjustment(record, tierConfig, options, migrationWindowTTL);
        const recommendedTTL = calculateRecommendedTTL(record, tierConfig, migrationWindowTTL, options);
        const reason = generateReason(record, tierConfig, needsAdjustment, options);
        return {
            record,
            tier: tierConfig.tier,
            tierInfo: tierConfig,
            needsAdjustment,
            recommendedTTL,
            reason
        };
    });
}
function loadTTLConfig(configPath) {
    if (!configPath) {
        return default_1.DEFAULT_TTL_TIERS;
    }
    try {
        const content = (0, fs_1.readFileSync)(configPath, 'utf-8');
        const config = JSON.parse(content);
        if (Array.isArray(config)) {
            return config.sort((a, b) => a.min - b.min);
        }
        return default_1.DEFAULT_TTL_TIERS;
    }
    catch {
        return default_1.DEFAULT_TTL_TIERS;
    }
}
function parseMigrationWindow(window) {
    if (!window)
        return null;
    const hours = parseFloat(window);
    if (isNaN(hours) || hours <= 0)
        return null;
    return Math.floor(hours * 3600 / 2);
}
function getTierForTTL(ttl, tiers) {
    for (const tier of tiers) {
        if (ttl >= tier.min && ttl <= tier.max) {
            return tier;
        }
    }
    return tiers[tiers.length - 1];
}
function checkNeedsAdjustment(record, tierConfig, options, migrationWindowTTL) {
    if (migrationWindowTTL && record.ttl > migrationWindowTTL) {
        return true;
    }
    if (record.ttl > options.maxTTLWarn) {
        return true;
    }
    if (record.ttl < options.minTTLWarn && record.type !== 'A' && record.type !== 'AAAA') {
        return true;
    }
    if (tierConfig.tier === 'LEGACY') {
        return true;
    }
    if (record.type === 'CNAME' && record.ttl > 1800) {
        return true;
    }
    if (record.type === 'MX' && record.ttl > 3600) {
        return true;
    }
    return false;
}
function calculateRecommendedTTL(record, tierConfig, migrationWindowTTL, options) {
    if (migrationWindowTTL) {
        return Math.min(migrationWindowTTL, default_1.DEFAULT_MIGRATION_RECOMMENDED_TTL);
    }
    const typeRecommended = {
        'A': 300,
        'AAAA': 300,
        'CNAME': 300,
        'MX': 1800,
        'NS': 86400,
        'TXT': 3600,
        'SRV': 300,
        'PTR': 3600
    };
    const recommended = typeRecommended[record.type] || options.maxTTLWarn;
    return Math.min(recommended, 3600);
}
function generateReason(record, tierConfig, needsAdjustment, options) {
    if (!needsAdjustment) {
        return 'TTL 配置合理';
    }
    const reasons = [];
    if (tierConfig.tier === 'LEGACY') {
        reasons.push('TTL 超过 1 天，属于遗留配置');
    }
    if (record.ttl > options.maxTTLWarn) {
        reasons.push(`TTL 超过最大警告阈值 (${options.maxTTLWarn}s)`);
    }
    if (record.ttl < options.minTTLWarn && record.type !== 'A' && record.type !== 'AAAA') {
        reasons.push(`TTL 低于最小警告阈值 (${options.minTTLWarn}s)`);
    }
    if (record.type === 'CNAME' && record.ttl > 1800) {
        reasons.push('CNAME 记录建议 TTL <= 30 分钟');
    }
    if (record.type === 'MX' && record.ttl > 3600) {
        reasons.push('MX 记录建议 TTL <= 1 小时');
    }
    return reasons.join('; ') || '建议调整 TTL 以适应迁移';
}
function getTTLDistribution(analysis) {
    const distribution = {};
    for (const item of analysis) {
        distribution[item.tier] = (distribution[item.tier] || 0) + 1;
    }
    return distribution;
}
function getRecordsNeedingAdjustment(analysis) {
    return analysis.filter(a => a.needsAdjustment);
}
function getRecordsByTier(analysis, tier) {
    return analysis.filter(a => a.tier === tier);
}
//# sourceMappingURL=ttlAnalyzer.js.map