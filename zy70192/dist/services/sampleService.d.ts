import { Sample, SampleStatus, PaginatedResponse } from '../types';
export declare const generateSampleNo: () => string;
export declare const createSample: (data: {
    name: string;
    supplier: string;
    category: string;
    quantity: number;
    unitPrice: number;
}, operator: string) => Sample;
export declare const getSampleById: (id: string) => Sample;
export declare const getSampleByNo: (sampleNo: string) => Sample;
export declare const listSamples: (params?: {
    status?: SampleStatus;
    category?: string;
    supplier?: string;
    isFrozen?: boolean;
    keyword?: string;
}, page?: number, pageSize?: number) => PaginatedResponse<Sample>;
export declare const updateSampleStatus: (id: string, newStatus: SampleStatus, operator: string) => Sample;
export declare const updateSampleInfo: (id: string, data: {
    name?: string;
    supplier?: string;
    category?: string;
    quantity?: number;
    unitPrice?: number;
}, operator: string) => Sample;
export declare const freezeSample: (id: string, operator: string) => Sample;
export declare const unfreezeSample: (id: string, operator: string) => Sample;
export declare const getSampleSummary: () => {
    total: number;
    byStatus: Record<SampleStatus, number>;
    totalAmount: number;
    totalQuantity: number;
};
