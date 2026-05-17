import { RepairPartReturn, RepairPartReturnStatus, RepairPartReturnHistory, CreateReturnRequest, ShipRequest, ReceiveRequest, InspectionRequest, StockInRequest, PageResult } from '../types';
export declare enum ServiceErrorCode {
    SUCCESS = "SUCCESS",
    RECORD_NOT_FOUND = "RECORD_NOT_FOUND",
    INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION",
    IDEMPOTENT_CONFLICT = "IDEMPOTENT_CONFLICT",
    STOCK_RECOVERED_BLOCKED = "STOCK_RECOVERED_BLOCKED",
    VALIDATION_ERROR = "VALIDATION_ERROR"
}
export interface ServiceResult<T> {
    success: boolean;
    code: ServiceErrorCode;
    message: string;
    data?: T;
    nextStepHint?: string;
}
export declare class RepairPartReturnService {
    create(request: CreateReturnRequest): ServiceResult<RepairPartReturn>;
    getById(id: string): ServiceResult<RepairPartReturn>;
    getByReturnNo(returnNo: string): ServiceResult<RepairPartReturn>;
    list(page?: number, pageSize?: number, status?: RepairPartReturnStatus): ServiceResult<PageResult<RepairPartReturn>>;
    ship(id: string, request: ShipRequest): ServiceResult<RepairPartReturn>;
    receive(id: string, request: ReceiveRequest): ServiceResult<RepairPartReturn>;
    inspect(id: string, request: InspectionRequest, stockRecovered?: boolean): ServiceResult<RepairPartReturn>;
    stockIn(id: string, request: StockInRequest): ServiceResult<RepairPartReturn>;
    reject(id: string, operatorId: string, operatorName: string, remark?: string): ServiceResult<RepairPartReturn>;
    getHistories(returnId: string): ServiceResult<RepairPartReturnHistory[]>;
    exportCsv(status?: RepairPartReturnStatus): Promise<ServiceResult<string>>;
}
export declare const repairPartReturnService: RepairPartReturnService;
