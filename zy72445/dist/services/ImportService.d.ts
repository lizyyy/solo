import { TrackAlias, ImportBatch, HumanReadableError } from '../types';
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
    totalCount: number;
    errors: HumanReadableError[];
    importedTracks: TrackAlias[];
}
export declare class ImportService {
    private store;
    constructor();
    importTrackAliases(batchIdentifier: string, trackDataList: ImportTrackData[], importedBy: string): ImportResult;
    getImportBatch(batchId: string): ImportBatch | undefined;
    getTracksByBatch(batchId: string): TrackAlias[];
    getAllTrackAliases(): TrackAlias[];
}
