import { DataStore } from '../store/DataStore';
import { BOUNDARY_RULES } from '../constants/boundaryRules';
import { getHumanReadableError } from '../constants/errorMessages';
import { TrackAlias, ImportBatch, HumanReadableError, ImportItemDetail, ImportItemCategory } from '../types';
import { ChangeHistoryService } from './ChangeHistoryService';

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

export class ImportService {
  private store: DataStore;
  private historyService: ChangeHistoryService;

  constructor() {
    this.store = DataStore.getInstance();
    this.historyService = new ChangeHistoryService();
  }

  importTrackAliases(
    batchIdentifier: string,
    trackDataList: ImportTrackData[],
    importedBy: string
  ): ImportResult {
    const errors: HumanReadableError[] = [];
    const importedTracks: TrackAlias[] = [];
    const itemDetails: ImportItemDetail[] = [];
    let thisTimeDuplicateCount = 0;
    let historicalDuplicateCount = 0;
    let newRecordCount = 0;

    if (!batchIdentifier || batchIdentifier.trim() === '') {
      return {
        success: false,
        batchId: '',
        importedCount: 0,
        skippedCount: 0,
        newRecordCount: 0,
        thisTimeDuplicateCount: 0,
        historicalDuplicateCount: 0,
        totalCount: trackDataList.length,
        errors: [getHumanReadableError('batch_identifier_required')],
        importedTracks: [],
        itemDetails: []
      };
    }

    const existingBatch = this.store.getImportBatchByIdentifier(batchIdentifier);
    if (existingBatch && BOUNDARY_RULES.importDeduplication.checkBatchIdentifier) {
      errors.push(getHumanReadableError('duplicate_import_batch'));
      for (const trackData of trackDataList) {
        itemDetails.push({
          trackId: trackData.trackId,
          trackName: trackData.trackName,
          aliases: trackData.aliases,
          category: ImportItemCategory.THIS_TIME_DUPLICATE,
          existingBatchId: existingBatch.id,
          existingBatchIdentifier: existingBatch.batchIdentifier
        });
        thisTimeDuplicateCount++;
      }
      return {
        success: true,
        batchId: existingBatch.id,
        importedCount: trackDataList.length,
        skippedCount: trackDataList.length,
        newRecordCount: 0,
        thisTimeDuplicateCount,
        historicalDuplicateCount: 0,
        totalCount: trackDataList.length,
        errors,
        importedTracks: [],
        itemDetails
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
        const existing = this.store.findExistingTrackAlias(trackData.trackId, trackData.aliases);
        if (existing) {
          if (existing.batch.id === batch.id) {
            itemDetails.push({
              trackId: trackData.trackId,
              trackName: trackData.trackName,
              aliases: trackData.aliases,
              category: ImportItemCategory.THIS_TIME_DUPLICATE,
              existingBatchId: existing.batch.id,
              existingBatchIdentifier: existing.batch.batchIdentifier
            });
            thisTimeDuplicateCount++;
          } else {
            itemDetails.push({
              trackId: trackData.trackId,
              trackName: trackData.trackName,
              aliases: trackData.aliases,
              category: ImportItemCategory.HISTORICAL_DUPLICATE,
              existingBatchId: existing.batch.id,
              existingBatchIdentifier: existing.batch.batchIdentifier
            });
            historicalDuplicateCount++;
          }
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

      itemDetails.push({
        trackId: trackData.trackId,
        trackName: trackData.trackName,
        aliases: trackData.aliases,
        category: ImportItemCategory.NEW_RECORD,
        newRecordId: trackAlias.id
      });
      newRecordCount++;

      this.historyService.recordChange(
        'track_alias',
        trackAlias.id,
        'import',
        '',
        JSON.stringify({ trackId: trackData.trackId, trackName: trackData.trackName, aliases: trackData.aliases }),
        importedBy,
        '曲目别名表第一次导入',
        batch.id,
        'track_alias',
        trackAlias.id
      );
    }

    this.store.updateImportBatch(batch.id, {
      status: 'completed',
      trackCount: importedTracks.length
    });

    return {
      success: true,
      batchId: batch.id,
      importedCount: trackDataList.length,
      skippedCount: thisTimeDuplicateCount + historicalDuplicateCount,
      newRecordCount,
      thisTimeDuplicateCount,
      historicalDuplicateCount,
      totalCount: trackDataList.length,
      errors,
      importedTracks,
      itemDetails
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
