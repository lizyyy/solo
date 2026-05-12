import { Asset, AssetHistory, ValidationResult, CorrectionRecord, AssetDetailView } from '../types';
import { FileStorage } from '../storage/FileStorage';
export declare class AssetService {
    private storage;
    private depreciationService;
    private processedIds;
    constructor(storage: FileStorage);
    private findAsset;
    private findStore;
    validateAll(): Promise<ValidationResult>;
    processAllTransactions(operator?: string): Promise<{
        assets: Asset[];
        history: AssetHistory[];
        corrections: CorrectionRecord[];
        warnings: string[];
    }>;
    saveProcessingResults(assets: Asset[], history: AssetHistory[], corrections: CorrectionRecord[]): Promise<void>;
    getAssetDetail(assetId: string): Promise<AssetDetailView | null>;
}
