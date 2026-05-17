"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheAnalyzer = void 0;
exports.analyzeCacheData = analyzeCacheData;
const constants_1 = require("./constants");
const aggregator_1 = require("./aggregator");
class CacheAnalyzer {
    analyze(input) {
        const { entries, badLines, totalLines, options } = input;
        const stages = (0, aggregator_1.aggregateStages)(entries);
        const cacheKeyChanges = (0, aggregator_1.compareCacheKeys)(entries);
        const timeAttribution = this.calculateTimeAttribution(stages);
        const summary = this.calculateSummary(stages, timeAttribution);
        const recommendations = this.generateRecommendations(stages, cacheKeyChanges, timeAttribution);
        return {
            metadata: {
                generatedAt: new Date().toISOString(),
                inputFile: options.input,
                totalLines,
                parsedLines: entries.length,
                badLines: badLines.length,
            },
            summary,
            stages,
            cacheKeyChanges,
            timeAttribution,
            badLines,
            recommendations,
        };
    }
    calculateTimeAttribution(stages) {
        const totalDuration = stages.reduce((sum, s) => sum + s.totalDurationMs, 0);
        return stages.map(stage => {
            const cacheMissOverheadMs = this.estimateCacheMissOverhead(stage);
            const percentageOfTotal = totalDuration > 0
                ? (stage.totalDurationMs / totalDuration) * 100
                : 0;
            return {
                stage: stage.name,
                totalTimeMs: stage.totalDurationMs,
                cacheMissOverheadMs,
                percentageOfTotal: Math.round(percentageOfTotal * 100) / 100,
            };
        }).sort((a, b) => b.cacheMissOverheadMs - a.cacheMissOverheadMs);
    }
    estimateCacheMissOverhead(stage) {
        if (stage.missCount === 0)
            return 0;
        const avgHitDuration = stage.hitCount > 0
            ? stage.totalDurationMs / (stage.hitCount + stage.missCount) * 0.3
            : stage.avgDurationMs * 0.3;
        const overheadPerMiss = Math.max(0, stage.avgDurationMs - avgHitDuration);
        return Math.round(stage.missCount * overheadPerMiss);
    }
    calculateSummary(stages, timeAttribution) {
        const totalCacheHits = stages.reduce((sum, s) => sum + s.hitCount, 0);
        const totalCacheMisses = stages.reduce((sum, s) => sum + s.missCount, 0);
        const totalCacheChecks = totalCacheHits + totalCacheMisses;
        const hitRate = totalCacheChecks > 0
            ? totalCacheHits / totalCacheChecks
            : 0;
        return {
            totalStages: stages.length,
            totalCacheHits,
            totalCacheMisses,
            hitRate: Math.round(hitRate * 10000) / 10000,
            totalDurationMs: stages.reduce((sum, s) => sum + s.totalDurationMs, 0),
            cacheMissOverheadMs: timeAttribution.reduce((sum, t) => sum + t.cacheMissOverheadMs, 0),
        };
    }
    generateRecommendations(stages, cacheKeyChanges, timeAttribution) {
        const recommendations = [];
        const totalHits = stages.reduce((sum, s) => sum + s.hitCount, 0);
        const totalMisses = stages.reduce((sum, s) => sum + s.missCount, 0);
        const hitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 1;
        if (hitRate < 0.5) {
            recommendations.push(constants_1.RECOMMENDATIONS.LOW_HIT_RATE);
        }
        const totalOverhead = timeAttribution.reduce((sum, t) => sum + t.cacheMissOverheadMs, 0);
        const totalDuration = timeAttribution.reduce((sum, t) => sum + t.totalTimeMs, 0);
        if (totalDuration > 0 && totalOverhead / totalDuration > 0.3) {
            recommendations.push(constants_1.RECOMMENDATIONS.HIGH_MISS_OVERHEAD);
        }
        const keyChangesWithChange = cacheKeyChanges.filter(c => c.isChanged);
        if (keyChangesWithChange.length > 3) {
            recommendations.push(constants_1.RECOMMENDATIONS.FREQUENT_KEY_CHANGE);
        }
        const longMissStages = timeAttribution.filter(t => t.cacheMissOverheadMs > constants_1.FORMAT_CONSTANTS.DURATION_THRESHOLD_MS);
        if (longMissStages.length > 0) {
            recommendations.push(constants_1.RECOMMENDATIONS.LONG_STAGE_MISS);
        }
        return recommendations;
    }
}
exports.CacheAnalyzer = CacheAnalyzer;
function analyzeCacheData(input) {
    const analyzer = new CacheAnalyzer();
    return analyzer.analyze(input);
}
