import { RepairPartReturn, RepairPartReturnStatus, RepairPartReturnHistory, CreateReturnRequest, ShipRequest, ReceiveRequest, InspectionRequest, StockInRequest } from '../types';
declare class RepairPartReturnStore {
    private returns;
    private histories;
    private returnNoCounter;
    create(request: CreateReturnRequest): RepairPartReturn;
    findById(id: string): RepairPartReturn | undefined;
    findByReturnNo(returnNo: string): RepairPartReturn | undefined;
    findByIdempotentKey(idempotentKey: string): RepairPartReturn | undefined;
    list(page?: number, pageSize?: number, status?: RepairPartReturnStatus): {
        list: RepairPartReturn[];
        total: number;
    };
    updateStatus(id: string, newStatus: RepairPartReturnStatus, operatorId: string, operatorName: string, remark?: string): RepairPartReturn;
    ship(id: string, request: ShipRequest): RepairPartReturn;
    receive(id: string, request: ReceiveRequest): RepairPartReturn;
    inspect(id: string, request: InspectionRequest, stockRecovered: boolean): RepairPartReturn;
    setNextStepHint(id: string, hint: string): void;
    stockIn(id: string, request: StockInRequest): RepairPartReturn;
    reject(id: string, operatorId: string, operatorName: string, remark?: string): RepairPartReturn;
    getHistories(returnId: string): RepairPartReturnHistory[];
    private addHistory;
    getAll(): RepairPartReturn[];
}
export declare const repairPartReturnStore: RepairPartReturnStore;
export {};
