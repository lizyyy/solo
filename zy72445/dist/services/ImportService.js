"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
const DataStore_1 = require("../store/DataStore");
const boundaryRules_1 = require("../constants/boundaryRules");
const errorMessages_1 = require("../constants/errorMessages");
const types_1 = require("../types");
const ChangeHistoryService_1 = require("./ChangeHistoryService");
class ImportService {
    constructor() {
        this.store = DataStore_1.DataStore.getInstance();
        this.historyService = new ChangeHistoryService_1.ChangeHistoryService();
    }
    importTrackAliases(batchIdentifier, trackDataList, importedBy) {
        const errors = [];
        const importedTracks = [];
        const itemDetails = [];
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
                errors: [(0, errorMessages_1.getHumanReadableError)('batch_identifier_required')],
                importedTracks: [],
                itemDetails: []
            };
        }
        const existingBatch = this.store.getImportBatchByIdentifier(batchIdentifier);
        if (existingBatch && boundaryRules_1.BOUNDARY_RULES.importDeduplication.checkBatchIdentifier) {
            errors.push((0, errorMessages_1.getHumanReadableError)('duplicate_import_batch'));
            for (const trackData of trackDataList) {
                itemDetails.push({
                    trackId: trackData.trackId,
                    trackName: trackData.trackName,
                    aliases: trackData.aliases,
                    category: types_1.ImportItemCategory.THIS_TIME_DUPLICATE,
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
            if (boundaryRules_1.BOUNDARY_RULES.importDeduplication.checkTrackIdAndAliases) {
                const existing = this.store.findExistingTrackAlias(trackData.trackId, trackData.aliases);
                if (existing) {
                    if (existing.batch.id === batch.id) {
                        itemDetails.push({
                            trackId: trackData.trackId,
                            trackName: trackData.trackName,
                            aliases: trackData.aliases,
                            category: types_1.ImportItemCategory.THIS_TIME_DUPLICATE,
                            existingBatchId: existing.batch.id,
                            existingBatchIdentifier: existing.batch.batchIdentifier
                        });
                        thisTimeDuplicateCount++;
                    }
                    else {
                        itemDetails.push({
                            trackId: trackData.trackId,
                            trackName: trackData.trackName,
                            aliases: trackData.aliases,
                            category: types_1.ImportItemCategory.HISTORICAL_DUPLICATE,
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
                category: types_1.ImportItemCategory.NEW_RECORD,
                newRecordId: trackAlias.id
            });
            newRecordCount++;
            this.historyService.recordChange('track_alias', trackAlias.id, 'import', '', JSON.stringify({ trackId: trackData.trackId, trackName: trackData.trackName, aliases: trackData.aliases }), importedBy, '曲目别名表第一次导入', batch.id, 'track_alias', trackAlias.id);
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
    getImportBatch(batchId) {
        return this.store.getImportBatch(batchId);
    }
    getTracksByBatch(batchId) {
        return this.store.getTrackAliasesByBatch(batchId);
    }
    getAllTrackAliases() {
        return this.store.getAllTrackAliases();
    }
}
exports.ImportService = ImportService;
//# sourceMappingURL=ImportService.js.map