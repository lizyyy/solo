import { Order, Refund, Party, Config, Anomaly } from './types';
export declare class DataLoader {
    private orders;
    private refunds;
    private parties;
    private config;
    private anomalies;
    private duplicateOrders;
    loadConfig(configPath: string): Config;
    loadOrders(ordersPath: string): Order[];
    loadRefunds(refundsPath: string): Refund[];
    loadParties(partiesPath: string): Party[];
    private validateConfig;
    private checkRuleOverlap;
    getOrder(orderId: string): Order | undefined;
    getRefundsForOrder(orderId: string): Refund[];
    getParty(partyId: string): Party | undefined;
    getAnomalies(): Anomaly[];
    getDuplicateOrders(): string[];
    getConfig(): Config;
    getAllOrders(): Order[];
    validateAll(): Anomaly[];
}
//# sourceMappingURL=data-loader.d.ts.map