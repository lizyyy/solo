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
            fingerprint,
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
        this.historyManager.createSnapshot(layer, 'import', importedBy, null, {
          reason: '首次导入CAD图层',
          nextStep: '关联测距仪记录和补录路线',
          reviewRequired: false
        });
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

    this.historyManager.createSnapshot(layer, 'update', operator, { before, after: JSON.parse(JSON.stringify(layer)) }, {
      reason: '更新CAD图层',
      nextStep: '请确认关联的温区是否需要同步更新',
      reviewRequired: true
    });
    return layer;
  }

  getLayerHistory(layerId) {
    return this.historyManager.getHistory(layerId);
  }

  getLayerDetail(layerId) {
    const layer = this.getLayerById(layerId);
    if (!layer) return null;

    const latestSnapshot = this.historyManager.getLatestSnapshot(layerId);
    const history = this.historyManager.getHistory(layerId, 50);

    return {
      layer,
      latestSnapshot,
      history
    };
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
