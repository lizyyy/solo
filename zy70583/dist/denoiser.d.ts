import { Alert, Rule, Silence, AlertAggregation, NoiseScore, MatchResult, DenoiseCandidate } from './types';
export declare class Denoiser {
    private alerts;
    private rules;
    private silences;
    private threshold;
    constructor(alerts: Alert[], rules: Rule[], silences: Silence[], threshold?: number);
    aggregateAlerts(): AlertAggregation[];
    matchSilences(aggregations: AlertAggregation[]): {
        ruleId: string;
        ruleName: string;
        matches: MatchResult[];
    }[];
    private doesAlertMatchSilence;
    calculateNoiseScores(aggregations: AlertAggregation[]): NoiseScore[];
    private calculateFrequencyFactor;
    private calculateDiversityFactor;
    private calculateDurationFactor;
    private calculateSeverityFactor;
    generateCandidates(noiseScores: NoiseScore[], silenceMatches: {
        ruleId: string;
        ruleName: string;
        matches: MatchResult[];
    }[]): DenoiseCandidate[];
}
