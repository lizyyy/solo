import { DataStore } from "../storage/store";
import { BusinessRulesEngine } from "../engine/rules";
export type ImportType = "contract" | "milestone" | "delivery" | "acceptance" | "invoice" | "payment";
export interface ImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    details: {
        type: ImportType;
        id: string;
        no: string;
        action: "created" | "skipped" | "error";
        reason?: string;
    }[];
}
export declare class DataImporter {
    private store;
    private engine;
    constructor(store?: DataStore, engine?: BusinessRulesEngine);
    importFromJSONFile(filePath: string, type: ImportType, operator?: string): ImportResult;
    importData(data: unknown, type: ImportType, operator?: string): ImportResult;
    private importSingleItem;
    private importContract;
    private importMilestone;
    private importDeliveryProof;
    private importAcceptanceForm;
    private importInvoice;
    private importPaymentRecord;
}
export declare const defaultImporter: DataImporter;
