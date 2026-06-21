"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDuplicates = detectDuplicates;
exports.detectBoundarySamples = detectBoundarySamples;
exports.detectOutliers = detectOutliers;
exports.clearDetectionAnomalies = clearDetectionAnomalies;
exports.detectAllAnomalies = detectAllAnomalies;
exports.getAnomalySummary = getAnomalySummary;
exports.isolateAnomalousSamples = isolateAnomalousSamples;
const factories_1 = require("../models/factories");
const DEFAULT_CONFIG = {
    duplicateTolerance: 1e-6,
    boundaryThreshold: 0.1,
    outlierIqrMultiplier: 1.5,
    minBoundarySamples: 5,
};
function detectDuplicates(samples, tolerance = DEFAULT_CONFIG.duplicateTolerance) {
    const anomalies = [];
    const processed = new Set();
    samples.forEach((sample, i) => {
        if (sample.status === 'withdrawn' || processed.has(sample.id))
            return;
        const group = [sample];
        samples.forEach((other, j) => {
            if (i === j || other.status === 'withdrawn' || processed.has(other.id))
                return;
            const xDiff = Math.abs(sample.x - other.x);
            const yDiff = Math.abs(sample.y - other.y);
            if (xDiff <= tolerance && yDiff <= tolerance) {
                group.push(other);
            }
        });
        if (group.length > 1) {
            const ids = group.map(s => s.id);
            const anomalyId = `dup-${ids.join('-')}`;
            group.forEach(s => {
                processed.add(s.id);
                const existingAnomaly = s.anomalies.find(a => a.id === anomalyId);
                if (!existingAnomaly) {
                    const anomaly = (0, factories_1.createAnomaly)('duplicate', `发现 ${group.length} 条重复样本 (x=${sample.x.toFixed(4)}, y=${sample.y.toFixed(4)})`, 'high', ids);
                    anomaly.id = anomalyId;
                    s.anomalies.push(anomaly);
                    anomalies.push(anomaly);
                }
            });
        }
    });
    return anomalies;
}
function detectBoundarySamples(samples, threshold = DEFAULT_CONFIG.boundaryThreshold, minSamples = DEFAULT_CONFIG.minBoundarySamples) {
    const anomalies = [];
    const validSamples = samples.filter(s => s.status !== 'withdrawn');
    if (validSamples.length < minSamples) {
        validSamples.forEach(sample => {
            const anomaly = (0, factories_1.createAnomaly)('boundary', `样本量不足 (${validSamples.length}/${minSamples})，边界区域样本可靠性较低，建议补充数据`, 'medium', [sample.id]);
            sample.anomalies.push(anomaly);
            anomalies.push(anomaly);
        });
        return anomalies;
    }
    const xs = validSamples.map(s => s.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const range = maxX - minX;
    const lowerBound = minX + range * threshold;
    const upperBound = maxX - range * threshold;
    validSamples.forEach(sample => {
        if (sample.x < lowerBound || sample.x > upperBound) {
            const position = sample.x < lowerBound ? '低端' : '高端';
            const anomaly = (0, factories_1.createAnomaly)('boundary', `位于数据${position}边界区域 (x=${sample.x.toFixed(4)})，拟合时需谨慎处理`, 'low', [sample.id]);
            sample.anomalies.push(anomaly);
            anomalies.push(anomaly);
        }
    });
    return anomalies;
}
function detectOutliers(samples, iqrMultiplier = DEFAULT_CONFIG.outlierIqrMultiplier) {
    const anomalies = [];
    const validSamples = samples.filter(s => s.status !== 'withdrawn');
    if (validSamples.length < 4)
        return anomalies;
    const ys = validSamples.map(s => s.y).sort((a, b) => a - b);
    const q1 = ys[Math.floor(ys.length * 0.25)];
    const q3 = ys[Math.floor(ys.length * 0.75)];
    const iqr = q3 - q1;
    const lowerFence = q1 - iqrMultiplier * iqr;
    const upperFence = q3 + iqrMultiplier * iqr;
    validSamples.forEach(sample => {
        if (sample.y < lowerFence || sample.y > upperFence) {
            const direction = sample.y < lowerFence ? '偏低' : '偏高';
            const anomaly = (0, factories_1.createAnomaly)('outlier', `Y值异常${direction} (y=${sample.y.toFixed(4)})，超出 ${iqrMultiplier} 倍IQR范围 [${lowerFence.toFixed(4)}, ${upperFence.toFixed(4)}]`, 'high', [sample.id]);
            sample.anomalies.push(anomaly);
            anomalies.push(anomaly);
        }
    });
    return anomalies;
}
function clearDetectionAnomalies(samples) {
    samples.forEach(s => {
        s.anomalies = s.anomalies.filter(a => {
            if (a.type === 'withdrawn')
                return true;
            if (a.resolved)
                return true;
            return false;
        });
    });
}
function detectAllAnomalies(samples, config = {}) {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const allAnomalies = [];
    clearDetectionAnomalies(samples);
    allAnomalies.push(...detectDuplicates(samples, fullConfig.duplicateTolerance));
    allAnomalies.push(...detectBoundarySamples(samples, fullConfig.boundaryThreshold, fullConfig.minBoundarySamples));
    allAnomalies.push(...detectOutliers(samples, fullConfig.outlierIqrMultiplier));
    samples.forEach(sample => {
        if (sample.status === 'withdrawn' && !sample.anomalies.some(a => a.type === 'withdrawn')) {
            const anomaly = (0, factories_1.createAnomaly)('withdrawn', `样本已撤回: ${sample.withdrawnReason || '无理由'}`, 'high', [sample.id]);
            sample.anomalies.push(anomaly);
            allAnomalies.push(anomaly);
        }
    });
    return allAnomalies;
}
function getAnomalySummary(samples) {
    const summary = {
        duplicate: 0,
        outlier: 0,
        boundary: 0,
        withdrawn: 0,
        total: 0,
    };
    const seenAnomalies = new Set();
    samples.forEach(sample => {
        sample.anomalies.forEach(anomaly => {
            if (!seenAnomalies.has(anomaly.id)) {
                seenAnomalies.add(anomaly.id);
                summary[anomaly.type] = (summary[anomaly.type] || 0) + 1;
                summary.total++;
            }
        });
    });
    return summary;
}
function isolateAnomalousSamples(samples) {
    const normal = [];
    const anomalous = [];
    samples.forEach(sample => {
        const hasUnresolvedHighAnomaly = sample.anomalies.some(a => !a.resolved && a.severity === 'high');
        if (hasUnresolvedHighAnomaly || sample.status === 'withdrawn') {
            anomalous.push(sample);
        }
        else {
            normal.push(sample);
        }
    });
    return { normal, anomalous };
}
//# sourceMappingURL=anomalyDetection.js.map