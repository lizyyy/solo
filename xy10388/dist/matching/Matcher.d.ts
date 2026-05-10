import { MatchResult } from '../types';
export declare class Matcher {
    private conditionOrder;
    matchAll(): Promise<MatchResult[]>;
    matchByBuyer(buyerId: string): Promise<MatchResult[]>;
    matchBySeller(sellerId: string): Promise<MatchResult[]>;
    private evaluateMatch;
    private createMatchResult;
    private generateExplanation;
    private checkConditionMatch;
    private normalizeTitle;
    private normalizeEdition;
    private getConditionDisplay;
    private sortResults;
}
export declare const matcher: Matcher;
