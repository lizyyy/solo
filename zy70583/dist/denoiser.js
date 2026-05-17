"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Denoiser = void 0;
class Denoiser {
    alerts;
    rules;
    silences;
    threshold;
    constructor(alerts, rules, silences, threshold = 50) {
        this.alerts = alerts;
        this.rules = rules;
        this.silences = silences;
        this.threshold = threshold;
    }
    aggregateAlerts() {
        const ruleGroups = new Map();
        this.alerts.forEach((alert) => {
            const key = alert.ruleId || alert.ruleName;
            if (!ruleGroups.has(key)) {
                ruleGroups.set(key, []);
            }
            ruleGroups.get(key).push(alert);
        });
        const aggregations = [];
        ruleGroups.forEach((alerts, ruleId) => {
            const firstAlert = alerts[0];
            const timestamps = alerts.map((a) => a.timestamp);
            const fingerprints = new Set(alerts.map((a) => a.fingerprint)).size;
            const labelValues = {};
            alerts.forEach((alert) => {
                Object.entries(alert.labels).forEach(([key, value]) => {
                    if (!labelValues[key]) {
                        labelValues[key] = new Set();
                    }
                    labelValues[key].add(value);
                });
            });
            const labels = {};
            Object.entries(labelValues).forEach(([key, values]) => {
                labels[key] = Array.from(values);
            });
            aggregations.push({
                ruleId,
                ruleName: firstAlert.ruleName,
                totalCount: alerts.length,
                severity: firstAlert.severity,
                uniqueFingerprints: fingerprints,
                firstSeen: Math.min(...timestamps),
                lastSeen: Math.max(...timestamps),
                labels,
            });
        });
        return aggregations.sort((a, b) => b.totalCount - a.totalCount);
    }
    matchSilences(aggregations) {
        const ruleGroups = new Map();
        this.alerts.forEach((alert) => {
            const key = alert.ruleId || alert.ruleName;
            if (!ruleGroups.has(key)) {
                ruleGroups.set(key, []);
            }
            ruleGroups.get(key).push(alert);
        });
        return aggregations.map((agg) => {
            const alerts = ruleGroups.get(agg.ruleId) || [];
            const matches = [];
            this.silences.forEach((silence) => {
                if (silence.status !== 'active')
                    return;
                let matchedAlertCount = 0;
                const matchedLabels = new Set();
                alerts.forEach((alert) => {
                    if (this.doesAlertMatchSilence(alert, silence)) {
                        matchedAlertCount++;
                        silence.matchers.forEach((m) => matchedLabels.add(m.name));
                    }
                });
                if (matchedAlertCount > 0) {
                    matches.push({
                        silenceId: silence.id,
                        silenceComment: silence.comment,
                        matchedBy: Array.from(matchedLabels),
                        matchedAlertCount,
                    });
                }
            });
            return {
                ruleId: agg.ruleId,
                ruleName: agg.ruleName,
                matches,
            };
        });
    }
    doesAlertMatchSilence(alert, silence) {
        for (const matcher of silence.matchers) {
            const alertValue = alert.labels[matcher.name];
            if (matcher.isRegex) {
                try {
                    const regex = new RegExp(matcher.value);
                    const isMatch = alertValue !== undefined && regex.test(alertValue);
                    if (matcher.isEqual && !isMatch)
                        return false;
                    if (!matcher.isEqual && isMatch)
                        return false;
                }
                catch {
                    if (matcher.isEqual && alertValue !== matcher.value)
                        return false;
                    if (!matcher.isEqual && alertValue === matcher.value)
                        return false;
                }
            }
            else {
                if (matcher.isEqual && alertValue !== matcher.value)
                    return false;
                if (!matcher.isEqual && alertValue === matcher.value)
                    return false;
            }
        }
        return true;
    }
    calculateNoiseScores(aggregations) {
        return aggregations.map((agg) => {
            const factors = [];
            let totalScore = 0;
            let totalWeight = 0;
            const frequencyFactor = this.calculateFrequencyFactor(agg);
            factors.push(frequencyFactor);
            totalScore += frequencyFactor.score * frequencyFactor.weight;
            totalWeight += frequencyFactor.weight;
            const diversityFactor = this.calculateDiversityFactor(agg);
            factors.push(diversityFactor);
            totalScore += diversityFactor.score * diversityFactor.weight;
            totalWeight += diversityFactor.weight;
            const durationFactor = this.calculateDurationFactor(agg);
            factors.push(durationFactor);
            totalScore += durationFactor.score * durationFactor.weight;
            totalWeight += durationFactor.weight;
            const severityFactor = this.calculateSeverityFactor(agg);
            factors.push(severityFactor);
            totalScore += severityFactor.score * severityFactor.weight;
            totalWeight += severityFactor.weight;
            const normalizedScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
            let recommendation;
            let confidence = 0;
            if (normalizedScore >= 80) {
                recommendation = 'silence';
                confidence = 0.9;
            }
            else if (normalizedScore >= 60) {
                recommendation = 'tune';
                confidence = 0.7;
            }
            else if (normalizedScore >= this.threshold) {
                recommendation = 'review';
                confidence = 0.5;
            }
            else {
                recommendation = 'keep';
                confidence = 0.8;
            }
            return {
                ruleId: agg.ruleId,
                ruleName: agg.ruleName,
                totalScore: normalizedScore,
                factors,
                recommendation,
                confidence,
            };
        });
    }
    calculateFrequencyFactor(agg) {
        const score = Math.min(100, agg.totalCount * 5);
        return {
            name: '触发频率',
            score,
            description: `共触发 ${agg.totalCount} 次`,
            weight: 0.35,
        };
    }
    calculateDiversityFactor(agg) {
        const labelCount = Object.keys(agg.labels).length;
        const valueCounts = Object.values(agg.labels).reduce((sum, values) => sum + values.length, 0);
        const diversity = valueCounts / (labelCount || 1);
        const score = diversity > 10 ? 80 : diversity > 5 ? 50 : 20;
        return {
            name: '标签多样性',
            score,
            description: `${labelCount} 个标签, ${valueCounts} 个不同值`,
            weight: 0.25,
        };
    }
    calculateDurationFactor(agg) {
        const durationHours = (agg.lastSeen - agg.firstSeen) / (1000 * 60 * 60);
        let score = 0;
        if (durationHours > 168) {
            score = 90;
        }
        else if (durationHours > 72) {
            score = 70;
        }
        else if (durationHours > 24) {
            score = 50;
        }
        else if (durationHours > 8) {
            score = 30;
        }
        return {
            name: '持续时长',
            score,
            description: `持续 ${Math.round(durationHours * 10) / 10} 小时`,
            weight: 0.25,
        };
    }
    calculateSeverityFactor(agg) {
        const severityScores = {
            info: 80,
            warning: 50,
            critical: 20,
        };
        const score = severityScores[agg.severity] || 50;
        return {
            name: '告警级别',
            score,
            description: `级别: ${agg.severity}`,
            weight: 0.15,
        };
    }
    generateCandidates(noiseScores, silenceMatches) {
        const candidates = [];
        const silenceMatchMap = new Map(silenceMatches.map((m) => [m.ruleId, m.matches]));
        noiseScores.forEach((score) => {
            const matches = silenceMatchMap.get(score.ruleId) || [];
            if (score.recommendation === 'silence') {
                candidates.push({
                    type: 'silence',
                    ruleId: score.ruleId,
                    ruleName: score.ruleName,
                    suggestion: `建议为规则 ${score.ruleName} 创建静默规则`,
                    reason: `噪声评分 ${score.totalScore}，已达到静默阈值`,
                    impact: matches.length > 0 ? 'medium' : 'high',
                });
            }
            if (score.recommendation === 'tune') {
                candidates.push({
                    type: 'rule_tune',
                    ruleId: score.ruleId,
                    ruleName: score.ruleName,
                    suggestion: `建议优化规则 ${score.ruleName} 的阈值或表达式`,
                    reason: `噪声评分 ${score.totalScore}，触发频率较高`,
                    impact: 'medium',
                });
            }
            if (matches.length > 0 && score.recommendation !== 'keep') {
                candidates.push({
                    type: 'label_adjust',
                    ruleId: score.ruleId,
                    ruleName: score.ruleName,
                    suggestion: `检查规则 ${score.ruleName} 的静默匹配是否合理`,
                    reason: `已匹配 ${matches.length} 个静默规则: ${matches.map((m) => m.silenceComment).join(', ')}`,
                    impact: 'low',
                });
            }
        });
        return candidates;
    }
}
exports.Denoiser = Denoiser;
