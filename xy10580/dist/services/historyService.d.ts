import { AppealHistory, AppealStatus } from '../types';
export declare function addHistory(orderNo: string, appealId: string, action: string, details?: string, operator?: string, fromStatus?: AppealStatus, toStatus?: AppealStatus): Promise<void>;
export declare function getHistoryByOrderNo(orderNo: string): Promise<AppealHistory[]>;
export declare function getHistoryByAppealId(appealId: string): Promise<AppealHistory[]>;
//# sourceMappingURL=historyService.d.ts.map