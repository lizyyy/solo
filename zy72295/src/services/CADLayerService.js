const { CADLayer } = require('../models/CADLayer');
const { HistoryManager } = require('../utils/history');
const { getUserFriendlyError } = require('../utils/errors');

class CADLayerService {
  constructor() {
    this.layers = [];
    this.historyManager = new HistoryManager();
    this.importedFingerprints = new Set();
  }

  importLayers(layerDataList, importedBy) {
    const results = {
      success: [],
      duplicates: [],
      errors: []
    };

    for (const layerData of layerDataList) {
      try {
        const fingerprint = CADLayer.generateFingerprint(layerData);
        
        if (this.importedFingerprints.has(fingerprint)) {
          results.duplicates.push({
            name: layerData.name,
            message: getUserFriendlyError('CAD_LAYER_DUPLICATE')
          });
          continue;
        }

        const layer = new CADLayer({
          ...layerData,
          importedBy
        });
        
        this.layers.push(layer);
        this.importedFingerprints.add(fingerprint);
        this.historyManager.createSnapshot(layer, 'import', importedBy);
        results.success.push(layer);
      } catch (error) {
        results.errors.push({
          name: layerData.name,
          error: error.message
        });
      }
    }

    return results;
  }

  getLayerById(id) {
    return this.layers.find(l => l.id === id);
  }

  getLayerByName(name) {
    return this.layers.find(l => l.name === name);
  }

  getAllLayers() {
    return [...this.layers];
  }

  updateLayer(id, updates, operator) {
    const layer = this.getLayerById(id);
    if (!layer) return null;

    const before = JSON.parse(JSON.stringify(layer));
    Object.assign(layer, updates);
    layer.version++;
    
    this.historyManager.createSnapshot(layer, 'update', operator, { before, after: layer });
    return layer;
  }

  getLayerHistory(layerId) {
    return this.historyManager.getHistory(layerId);
  }

  rollbackLayer(layerId, snapshotId) {
    const rollbackData = this.historyManager.rollback(snapshotId);
    if (!rollbackData) return null;

    const layer = this.getLayerById(layerId);
    if (!layer) return null;

    Object.assign(layer, rollbackData);
    return layer;
  }
}

module.exports = { CADLayerService };
