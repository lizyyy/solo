export interface Department {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
}
export interface Budget {
    id: string;
    department_id: string;
    period: string;
    budget_type: string;
    amount: number;
    used_amount: number;
    reserved_amount: number;
    threshold: number;
    status: string;
    description?: string;
    created_at: string;
    updated_at: string;
}
export interface PurchaseRequest {
    id: string;
    request_no: string;
    department_id: string;
    budget_id?: string;
    item_name: string;
    requested_amount: number;
    approved_amount?: number;
    status: string;
    request_date: string;
    requester?: string;
    description?: string;
    created_at: string;
    updated_at: string;
}
export interface ContractPayment {
    id: string;
    payment_no: string;
    contract_no?: string;
    department_id: string;
    budget_id?: string;
    purchase_request_id?: string;
    amount: number;
    payment_date: string;
    status: string;
    payee?: string;
    description?: string;
    created_at: string;
    updated_at: string;
}
export interface BudgetHistory {
    id: string;
    budget_id: string;
    action_type: string;
    amount: number;
    related_type?: string;
    related_id?: string;
    operator?: string;
    description?: string;
    created_at: string;
}
export interface Exception {
    id: string;
    exception_type: string;
    severity: string;
    related_type?: string;
    related_id?: string;
    message: string;
    details?: string;
    is_resolved: number;
    resolved_at?: string;
    created_at: string;
}
export interface ImportLog {
    id: string;
    file_name: string;
    file_type: string;
    total_records: number;
    success_count: number;
    error_count: number;
    status: string;
    error_message?: string;
    created_at: string;
}
export declare function getOrCreateDepartment(name: string): string;
export declare function createOrUpdateBudget(departmentName: string, period: string, budgetType: string, amount: number, threshold?: number, description?: string): string;
export declare function getBudgetById(id: string): Budget | undefined;
export declare function getBudgetByDepartmentPeriodType(departmentId: string, period: string, budgetType: string): Budget | undefined;
export declare function recordBudgetHistory(budgetId: string, actionType: string, amount: number, relatedType?: string, relatedId?: string, operator?: string, description?: string): void;
export declare function recordException(exceptionType: string, message: string, severity?: string, relatedType?: string, relatedId?: string, details?: string): string;
export declare function getAllDepartments(): Department[];
export declare function getAllBudgets(): Budget[];
export declare function getAllPurchaseRequests(): (PurchaseRequest & {
    department_name: string;
    budget_period?: string;
    budget_type?: string;
})[];
export declare function getAllContractPayments(): (ContractPayment & {
    department_name: string;
    budget_period?: string;
    budget_type?: string;
    request_no?: string;
})[];
export declare function getBudgetHistory(budgetId?: string): (BudgetHistory & {
    department_name?: string;
    period?: string;
    budget_type?: string;
})[];
export declare function getExceptions(isResolved?: boolean): Exception[];
export declare function getImportLogs(): ImportLog[];
export declare function resolveException(id: string): void;
//# sourceMappingURL=models.d.ts.map