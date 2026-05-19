import { BatchOperationResult } from './types';
export declare function batchImport(filePath: string): BatchOperationResult;
export declare function retryFailed(batchId: string): BatchOperationResult;
