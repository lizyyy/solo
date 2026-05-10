"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleMatcher = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
class RuleMatcher {
    constructor(rules) {
        this.rules = [...rules].sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return (0, dayjs_1.default)(a.createdAt).isBefore((0, dayjs_1.default)(b.createdAt)) ? -1 : 1;
        });
    }
    findRulesForOrder(order) {
        const orderTime = (0, dayjs_1.default)(order.createTime);
        const matched = [];
        for (const rule of this.rules) {
            const effective = (0, dayjs_1.default)(rule.effectiveTime);
            const expire = (0, dayjs_1.default)(rule.expireTime);
            if (orderTime.isBefore(effective) || orderTime.isAfter(expire)) {
                continue;
            }
            const matchResult = this.evaluateRule(rule, order);
            if (matchResult.matched) {
                matched.push({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    priority: rule.priority,
                    matchScore: matchResult.score,
                    matchReason: matchResult.reason,
                    matchedAt: order.createTime,
                });
            }
        }
        return matched.sort((a, b) => b.priority - a.priority);
    }
    evaluateRule(rule, order) {
        const conditions = rule.conditions;
        const reasons = [];
        let score = 0;
        if (conditions.minAmount) {
            if (order.totalAmount >= conditions.minAmount) {
                reasons.push(`订单金额 ¥${order.totalAmount} ≥ 满额门槛 ¥${conditions.minAmount}`);
                score += 100;
            }
            else {
                return { matched: false, score: 0, reason: `订单金额 ¥${order.totalAmount} < 满额门槛 ¥${conditions.minAmount}` };
            }
        }
        if (conditions.minQuantity) {
            const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
            if (totalQuantity >= conditions.minQuantity) {
                reasons.push(`商品数量 ${totalQuantity} ≥ 最低数量 ${conditions.minQuantity}`);
                score += 50;
            }
            else {
                return { matched: false, score: 0, reason: `商品数量 ${totalQuantity} < 最低数量 ${conditions.minQuantity}` };
            }
        }
        if (conditions.includeCategories && conditions.includeCategories.length > 0) {
            const hasMatchingCategory = order.items.some((item) => conditions.includeCategories.includes(item.category));
            if (hasMatchingCategory) {
                const matchedCats = order.items
                    .filter((item) => conditions.includeCategories.includes(item.category))
                    .map((item) => item.category);
                reasons.push(`包含指定品类: ${[...new Set(matchedCats)].join(', ')}`);
                score += 80;
            }
            else {
                return { matched: false, score: 0, reason: `不包含指定品类: ${conditions.includeCategories.join(', ')}` };
            }
        }
        if (conditions.excludeCategories && conditions.excludeCategories.length > 0) {
            const hasExcludedCategory = order.items.some((item) => conditions.excludeCategories.includes(item.category));
            if (hasExcludedCategory) {
                return { matched: false, score: 0, reason: `包含排除品类: ${conditions.excludeCategories.join(', ')}` };
            }
        }
        if (conditions.includeSkus && conditions.includeSkus.length > 0) {
            const hasMatchingSku = order.items.some((item) => conditions.includeSkus.includes(item.sku));
            if (hasMatchingSku) {
                reasons.push(`包含指定SKU`);
                score += 60;
            }
            else {
                return { matched: false, score: 0, reason: `不包含指定SKU: ${conditions.includeSkus.join(', ')}` };
            }
        }
        if (conditions.excludeSkus && conditions.excludeSkus.length > 0) {
            const hasExcludedSku = order.items.some((item) => conditions.excludeSkus.includes(item.sku));
            if (hasExcludedSku) {
                return { matched: false, score: 0, reason: `包含排除SKU: ${conditions.excludeSkus.join(', ')}` };
            }
        }
        return {
            matched: true,
            score,
            reason: reasons.join('; '),
        };
    }
    getRuleById(id) {
        return this.rules.find((r) => r.id === id);
    }
    getAllRules() {
        return this.rules;
    }
}
exports.RuleMatcher = RuleMatcher;
//# sourceMappingURL=RuleMatcher.js.map