import { TrackAlias, ImportBatch, HumanReadableError, ImportItemDetail } from '../types';
export interface ImportTrackData {
    trackId: string;
    trackName: string;
    aliases: string[];
}
export interface ImportResult {
    success: boolean;
    batchId: string;
    importedCount: number;
    skippedCount: number;
    newRecordCount: number;
    thisTimeDuplicateCount: number;
    historicalDuplicateCount: number;
    totalCount: number;
    errors: HumanReadableError[];
    importedTracks: TrackAlias[];
    itemDetails: ImportItemDetail[];
}
export declare class ImportService {
    private store;
    private historyService;
    constructor();
    importTrackAliases(batchIdentifier: string, trackDataList: ImportTrackData[], importedBy: string): ImportResult;
    getImportBatch(batchId: string): ImportBatch | undefined;
    getTracksByBatch(batchId: string): TrackAlias[];
    getAllTrackAliases(): TrackAlias[];
}
