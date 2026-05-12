import { CheckResult, AppealStatus } from '../types';
export declare function checkAppeal(appealId: string): Promise<CheckResult>;
export declare function checkPendingAppeals(): Promise<CheckResult[]>;
export declare function correctAppeal(appealId: string, newStatus: AppealStatus, newRevertedAmount: number, reason: string, operator: string): Promise<void>;
//# sourceMappingURL=checkService.d.ts.map