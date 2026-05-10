import { GiftRule, Order, MatchedRuleDetail } from '../types';
export declare class RuleMatcher {
    private rules;
    constructor(rules: GiftRule[]);
    findRulesForOrder(order: Order): MatchedRuleDetail[];
    private evaluateRule;
    getRuleById(id: string): GiftRule | undefined;
    getAllRules(): GiftRule[];
}
//# sourceMappingURL=RuleMatcher.d.ts.map