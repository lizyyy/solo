"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataLoader = void 0;
const fs = __importStar(require("fs"));
class DataLoader {
    constructor() {
        this.orders = new Map();
        this.refunds = new Map();
        this.parties = new Map();
        this.anomalies = [];
        this.duplicateOrders = [];
    }
    loadConfig(configPath) {
        const content = fs.readFileSync(configPath, 'utf-8');
        this.config = JSON.parse(content);
        this.validateConfig();
        return this.config;
    }
    loadOrders(ordersPath) {
        const content = fs.readFileSync(ordersPath, 'utf-8');
        const ordersArray = JSON.parse(content);
        ordersArray.forEach(order => {
            if (this.orders.has(order.id)) {
                this.duplicateOrders.push(order.id);
                this.anomalies.push({
                    type: 'duplicate_order',
                    severity: 'warning',
                    message: `订单 ${order.id} 重复导入，仅保留首次导入的数据`,
                    affectedParties: [order.merchantId]
                });
            }
            else {
                this.orders.set(order.id, order);
            }
        });
        return Array.from(this.orders.values());
    }
    loadRefunds(refundsPath) {
        const content = fs.readFileSync(refundsPath, 'utf-8');
        const refundsArray = JSON.parse(content);
        refundsArray.forEach(refund => {
            const existing = this.refunds.get(refund.orderId) || [];
            existing.push(refund);
            this.refunds.set(refund.orderId, existing);
        });
        return refundsArray;
    }
    loadParties(partiesPath) {
        const content = fs.readFileSync(partiesPath, 'utf-8');
        const partiesArray = JSON.parse(content);
        partiesArray.forEach(party => {
            this.parties.set(party.id, party);
        });
        return partiesArray;
    }
    validateConfig() {
        const { oldRules, newRules } = this.config;
        this.checkRuleOverlap(oldRules, '旧规则');
        this.checkRuleOverlap(newRules, '新规则');
    }
    checkRuleOverlap(rules, label) {
        const sortedRules = [...rules].sort((a, b) => new Date(a.effectiveStartDate).getTime() - new Date(b.effectiveStartDate).getTime());
        for (let i = 0; i < sortedRules.length - 1; i++) {
            const current = sortedRules[i];
            const next = sortedRules[i + 1];
            const currentEnd = current.effectiveEndDate
                ? new Date(current.effectiveEndDate).getTime()
                : Infinity;
            const nextStart = new Date(next.effectiveStartDate).getTime();
            if (currentEnd >= nextStart) {
                this.anomalies.push({
                    type: 'rule_overlap',
                    severity: 'error',
                    message: `${label}版本重叠: ${current.version} 与 ${next.version} 生效时间有重叠`,
                    affectedParties: ['platform', 'merchant', 'talent', 'serviceProvider']
                });
            }
        }
    }
    getOrder(orderId) {
        return this.orders.get(orderId);
    }
    getRefundsForOrder(orderId) {
        return this.refunds.get(orderId) || [];
    }
    getParty(partyId) {
        return this.parties.get(partyId);
    }
    getAnomalies() {
        return this.anomalies;
    }
    getDuplicateOrders() {
        return this.duplicateOrders;
    }
    getConfig() {
        return this.config;
    }
    getAllOrders() {
        return Array.from(this.orders.values());
    }
    validateAll() {
        const anomalies = [...this.anomalies];
        this.orders.forEach(order => {
            if (order.talentId && !this.parties.has(order.talentId)) {
                anomalies.push({
                    type: 'missing_talent',
                    severity: 'warning',
                    message: `订单 ${order.id} 的达人 ${order.talentId} 不存在`,
                    affectedParties: [order.merchantId, order.talentId]
                });
            }
            if (order.serviceProviderId && !this.parties.has(order.serviceProviderId)) {
                anomalies.push({
                    type: 'missing_service_provider',
                    severity: 'warning',
                    message: `订单 ${order.id} 的服务商 ${order.serviceProviderId} 不存在`,
                    affectedParties: [order.merchantId, order.serviceProviderId]
                });
            }
        });
        return anomalies;
    }
}
exports.DataLoader = DataLoader;
//# sourceMappingURL=data-loader.js.map