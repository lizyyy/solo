import { DataStore } from '../store/DataStore';
import { BOUNDARY_RULES } from '../constants/boundaryRules';
import { getHumanReadableError } from '../constants/errorMessages';
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

export class ImportService {
  private store: DataStore;

  constructor() {
    this.store = DataStore.getInstance();
  }

  importTrackAliases(
    batchIdentifier: string,
    trackDataList: ImportTrackData[],
    importedBy: string
  ): ImportResult {
    const errors: HumanReadableError[] = [];
    const importedTracks: TrackAlias[] = [];
    let skippedCount = 0;

    if (!batchIdentifier || batchIdentifier.trim() === '') {
      return {
        success: false,
        batchId: '',
        importedCount: 0,
        skippedCount: 0,
        totalCount: trackDataList.length,
        errors: [getHumanReadableError('batch_identifier_required')],
        importedTracks: []
      };
    }

    const existingBatch = this.store.getImportBatchByIdentifier(batchIdentifier);
    if (existingBatch && BOUNDARY_RULES.importDeduplication.checkBatchIdentifier) {
      errors.push(getHumanReadableError('duplicate_import_batch'));
      skippedCount = trackDataList.length;
      return {
        success: true,
        batchId: existingBatch.id,
        importedCount: 0,
        skippedCount,
        totalCount: trackDataList.length,
        errors,
        importedTracks: []
      };
    }

    const batch = this.store.createImportBatch({
      batchIdentifier,
      importedBy,
      trackCount: trackDataList.length,
      status: 'processing'
    });

    for (const trackData of trackDataList) {
      if (BOUNDARY_RULES.importDeduplication.checkTrackIdAndAliases) {
        if (this.store.trackAliasExists(trackData.trackId, trackData.aliases)) {
          skippedCount++;
          continue;
        }
      }

      const trackAlias = this.store.createTrackAlias({
        trackId: trackData.trackId,
        trackName: trackData.trackName,
        aliases: trackData.aliases,
        importBatchId: batch.id
      });
      importedTracks.push(trackAlias);
    }

    this.store.updateImportBatch(batch.id, {
      status: 'completed',
      trackCount: importedTracks.length
    });

    return {
      success: true,
      batchId: batch.id,
      importedCount: importedTracks.length,
      skippedCount,
      totalCount: trackDataList.length,
      errors,
      importedTracks
    };
  }

  getImportBatch(batchId: string): ImportBatch | undefined {
    return this.store.getImportBatch(batchId);
  }

  getTracksByBatch(batchId: string): TrackAlias[] {
    return this.store.getTrackAliasesByBatch(batchId);
  }

  getAllTrackAliases(): TrackAlias[] {
    return this.store.getAllTrackAliases();
  }
}
