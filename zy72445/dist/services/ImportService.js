"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
const DataStore_1 = require("../store/DataStore");
const boundaryRules_1 = require("../constants/boundaryRules");
const errorMessages_1 = require("../constants/errorMessages");
class ImportService {
    constructor() {
        this.store = DataStore_1.DataStore.getInstance();
    }
    importTrackAliases(batchIdentifier, trackDataList, importedBy) {
        const errors = [];
        const importedTracks = [];
        let skippedCount = 0;
        if (!batchIdentifier || batchIdentifier.trim() === '') {
            return {
                success: false,
                batchId: '',
                importedCount: 0,
                skippedCount: 0,
                totalCount: trackDataList.length,
                errors: [(0, errorMessages_1.getHumanReadableError)('batch_identifier_required')],
                importedTracks: []
            };
        }
        const existingBatch = this.store.getImportBatchByIdentifier(batchIdentifier);
        if (existingBatch && boundaryRules_1.BOUNDARY_RULES.importDeduplication.checkBatchIdentifier) {
            errors.push((0, errorMessages_1.getHumanReadableError)('duplicate_import_batch'));
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
            if (boundaryRules_1.BOUNDARY_RULES.importDeduplication.checkTrackIdAndAliases) {
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