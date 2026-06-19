const { CADLayer } = require('../models/CADLayer');
const { historyManager } = require('../utils/history');
const { getUserFriendlyError } = require('../utils/errors');
const { store } = require('../store/FileStore');

class CADLayerService {
  constructor() {
    this.historyManager = historyManager;
  }

  _toLayer(plain) {
    if (!plain) return null;
    const layer = new CADLayer({});
    Object.assign(layer, plain);
    return layer;
  }

  _saveLayer(layer) {
    const existing = store.getById('cadLayers', layer.id);
    if (existing) {
      return store.update('cadLayers', layer.id, JSON.parse(JSON.stringify(layer)));
    } else {
      return store.add('cadLayers', JSON.parse(JSON.stringify(layer)));
    }
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

        if (store.hasImportedFingerprint(fingerprint)) {
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

        this._saveLayer(layer);
        store.addImportedFingerprint(fingerprint);
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
    const plain = store.getById('cadLayers', id);
    return this._toLayer(plain);
  }

  getLayerByName(name) {
    const plain = store.findOne('cadLayers', l => l.name === name);
    return this._toLayer(plain);
  }

  getAllLayers() {
    return store.getAll('cadLayers').map(p => this._toLayer(p));
  }

  updateLayer(id, updates, operator) {
    const layer = this.getLayerById(id);
    if (!layer) return null;

    const before = JSON.parse(JSON.stringify(layer));
    Object.assign(layer, updates);
    layer.version++;
    this._saveLayer(layer);

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
    this._saveLayer(layer);
    return layer;
  }
}

const cadLayerService = new CADLayerService();

module.exports = { CADLayerService, cadLayerService };
