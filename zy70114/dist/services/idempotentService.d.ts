import { IdempotentRequest, OperationLog } from '../types';
export declare const checkIdempotent: (requestKey: string) => IdempotentRequest | null;
export declare const saveIdempotentResponse: (requestKey: string, requestType: string, responseData: string) => IdempotentRequest;
export declare const logOperation: (orderId: string, operatorId: string, operatorRole: string, operationType: string, operationDetail?: string, oldData?: object | null, newData?: object) => OperationLog;
export declare const getOperationLogs: (orderId: string, limit?: number) => OperationLog[];
export declare const cleanupExpiredIdempotent: () => number;
