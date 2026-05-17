"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheKeyComparer = exports.StageAggregator = void 0;
exports.aggregateStages = aggregateStages;
exports.compareCacheKeys = compareCacheKeys;
const constants_1 = require("./constants");
class StageAggregator {
    aggregate(entries) {
        const stageMap = new Map();
        for (const entry of entries) {
            const stage = entry.stage || 'unknown';
            if (!stageMap.has(stage)) {
                stageMap.set(stage, []);
            }
            stageMap.get(stage).push(entry);
        }
        const aggregations = [];
        for (const [name, stageEntries] of stageMap) {
            aggregations.push(this.aggregateStage(name, stageEntries));
        }
        return aggregations.sort((a, b) => b.totalDurationMs - a.totalDurationMs);
    }
    aggregateStage(name, entries) {
        const hitCount = this.countByStatus(entries, constants_1.CACHE_HIT_STATUS.HIT);
        const missCount = this.countByStatus(entries, constants_1.CACHE_HIT_STATUS.MISS);
        const partialCount = this.countByStatus(entries, constants_1.CACHE_HIT_STATUS.PARTIAL);
        const unknownCount = this.countByStatus(entries, constants_1.CACHE_HIT_STATUS.UNKNOWN);
        const durations = entries
            .filter(e => e.durationMs !== undefined)
            .map(e => e.durationMs);
        const totalDurationMs = durations.reduce((sum, d) => sum + d, 0);
        const avgDurationMs = durations.length > 0
            ? Math.round(totalDurationMs / durations.length)
            : 0;
        const cacheKeys = [...new Set(entries
                .filter(e => e.cacheKey)
                .map(e => e.cacheKey))];
        return {
            name,
            totalEntries: entries.length,
            hitCount,
            missCount,
            partialCount,
            unknownCount,
            totalDurationMs,
            avgDurationMs,
            cacheKeys,
        };
    }
    countByStatus(entries, status) {
        return entries.filter(e => e.hitStatus === status).length;
    }
}
exports.StageAggregator = StageAggregator;
class CacheKeyComparer {
    compare(entries) {
        const stageKeys = this.groupKeysByStage(entries);
        const comparisons = [];
        for (const [stage, keys] of stageKeys) {
            const stageComparisons = this.compareKeysInStage(stage, keys);
            comparisons.push(...stageComparisons);
        }
        return comparisons;
    }
    groupKeysByStage(entries) {
        const stageMap = new Map();
        for (const entry of entries) {
            if (!entry.cacheKey)
                continue;
            const stage = entry.stage || 'unknown';
            if (!stageMap.has(stage)) {
                stageMap.set(stage, new Set());
            }
            stageMap.get(stage).add(entry.cacheKey);
        }
        const result = new Map();
        for (const [stage, keys] of stageMap) {
            result.set(stage, [...keys]);
        }
        return result;
    }
    compareKeysInStage(stage, keys) {
        const comparisons = [];
        for (let i = 0; i < keys.length; i++) {
            const currentKey = keys[i];
            const previousKey = i > 0 ? keys[i - 1] : undefined;
            const isChanged = previousKey !== undefined && currentKey !== previousKey;
            const changedParts = isChanged
                ? this.findChangedParts(currentKey, previousKey)
                : undefined;
            comparisons.push({
                key: currentKey,
                previousKey,
                isChanged,
                changedParts,
                stage,
            });
        }
        return comparisons;
    }
    findChangedParts(current, previous) {
        const currentParts = current.split(/[-\s]+/);
        const previousParts = previous.split(/[-\s]+/);
        const changedParts = [];
        const maxLength = Math.max(currentParts.length, previousParts.length);
        for (let i = 0; i < maxLength; i++) {
            if (currentParts[i] !== previousParts[i]) {
                if (currentParts[i])
                    changedParts.push(`+${currentParts[i]}`);
                if (previousParts[i])
                    changedParts.push(`-${previousParts[i]}`);
            }
        }
        if (changedParts.length === 0) {
            changedParts.push('整体变化');
        }
        return changedParts;
    }
}
exports.CacheKeyComparer = CacheKeyComparer;
function aggregateStages(entries) {
    const aggregator = new StageAggregator();
    return aggregator.aggregate(entries);
}
function compareCacheKeys(entries) {
    const comparer = new CacheKeyComparer();
    return comparer.compare(entries);
}
