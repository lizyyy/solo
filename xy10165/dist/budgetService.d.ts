export interface CheckResult {
    budgetId: string;
    departmentName: string;
    period: string;
    budgetType: string;
    budgetAmount: number;
    usedAmount: number;
    reservedAmount: number;
    remainingAmount: number;
    usageRate: number;
    threshold: number;
    isOverThreshold: boolean;
    isOverBudget: boolean;
    issues: string[];
}
export interface ImportError {
    row: number;
    field: string;
    message: string;
    value?: string;
}
export interface ImportSummary {
    totalRecords: number;
    successCount: number;
    errorCount: number;
    errors: ImportError[];
}
export interface CreatePurchaseRequestParams {
    requestNo: string;
    departmentName: string;
    itemName: string;
    requestedAmount: number;
    requestDate: string;
    requester?: string;
    description?: string;
    period?: string;
    budgetType?: string;
}
export interface CreateContractPaymentParams {
    paymentNo: string;
    contractNo?: string;
    departmentName: string;
    amount: number;
    paymentDate: string;
    payee?: string;
    description?: string;
    requestNo?: string;
    period?: string;
    budgetType?: string;
}
export declare class BudgetAlreadyProcessedError extends Error {
    constructor(message: string);
}
export declare class BudgetExceededError extends Error {
    constructor(message: string);
}
export declare class InsufficientBudgetError extends Error {
    constructor(message: string);
}
export declare class BudgetNotConfiguredError extends Error {
    constructor(message: string);
}
export declare function createPurchaseRequest(params: CreatePurchaseRequestParams): string;
export declare function createContractPayment(params: CreateContractPaymentParams): string;
export declare function checkAllBudgets(): CheckResult[];
export declare function checkBudgetStatus(budgetId: string): CheckResult | undefined;
//# sourceMappingURL=budgetService.d.ts.map