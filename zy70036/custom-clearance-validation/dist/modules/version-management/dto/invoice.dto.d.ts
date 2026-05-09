import { DocumentStatus } from '../../../entities/invoice.entity';
declare class InvoiceItemDto {
    lineNumber: number;
    hsCode: string;
    productName: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    totalAmount: number;
}
export declare class CreateInvoiceDto {
    invoiceNumber: string;
    batchId: string;
    invoiceDate?: string;
    shipperName?: string;
    consigneeName?: string;
    totalAmount: number;
    currency?: string;
    totalQuantity: number;
    itemCount: number;
    status?: DocumentStatus;
    items: InvoiceItemDto[];
    remarks?: string;
}
export declare class UpdateInvoiceDto {
    invoiceDate?: string;
    shipperName?: string;
    consigneeName?: string;
    totalAmount?: number;
    currency?: string;
    totalQuantity?: number;
    itemCount?: number;
    status?: DocumentStatus;
    items?: InvoiceItemDto[];
    remarks?: string;
}
export declare class InvoiceFilterDto {
    batchId?: string;
    invoiceNumber?: string;
    status?: DocumentStatus;
}
export {};
