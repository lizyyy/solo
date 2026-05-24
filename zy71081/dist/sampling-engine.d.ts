import { SamplingConfig, Trace, SamplingResult, BudgetStats } from './types';
export declare class SamplingEngine {
    private config;
    private budgetState;
    private globalBudgetLimit;
    private ruleBudgetLimits;
    private budgetStats;
    private rng;
    private deterministic;
    constructor(config: SamplingConfig, overrideBudget?: number, seed?: number, deterministic?: boolean);
    private normalizeConfig;
    private initBudgetStats;
    evaluateTrace(trace: Trace): SamplingResult;
    private evaluateRule;
    private collectAllAttributes;
    private getAttributeValue;
    private checkAndConsumeBudget;
    private updateStats;
    getBudgetStats(): BudgetStats;
    getConfig(): SamplingConfig;
}
