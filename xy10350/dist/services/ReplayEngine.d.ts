import { Order, ReplayResult, ReplayState, DiffReport } from '../types';
import { RuleMatcher } from './RuleMatcher';
import { InventoryManager } from './InventoryManager';
export declare class ReplayEngine {
    private ruleMatcher;
    private inventoryManager;
    private replayId;
    private results;
    private originalOrderAmounts;
    constructor(ruleMatcher: RuleMatcher, inventoryManager: InventoryManager);
    getReplayId(): string;
    replayOrder(order: Order, originalAmount?: number): ReplayResult;
    replayOrders(orders: Order[]): ReplayResult[];
    confirmReservation(orderId: string, giftSku: string, quantity: number, ruleId: string): boolean;
    confirmAllReservations(): {
        confirmed: number;
        failed: number;
    };
    getDiff(order: Order): DiffReport;
    getReplayState(): ReplayState;
    getResults(): ReplayResult[];
    getInventoryManager(): InventoryManager;
    private buildExplanation;
}
//# sourceMappingURL=ReplayEngine.d.ts.map