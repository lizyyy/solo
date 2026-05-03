export class LocalStorage {
  constructor() {
    this.prefix = 'warehouse_picker_';
  }

  saveDraft(data) {
    try {
      const draft = {
        timestamp: Date.now(),
        warehouse: data.warehouse ? data.warehouse.toJSON() : null,
        skus: data.skus ? data.skus.map(s => s.toJSON()) : [],
        orders: data.orders ? data.orders.map(o => o.toJSON()) : [],
        selectedOrderIds: data.selectedOrderIds || []
      };
      
      localStorage.setItem(this.prefix + 'draft', JSON.stringify(draft));
      return { success: true, timestamp: draft.timestamp };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  loadDraft() {
    try {
      const data = localStorage.getItem(this.prefix + 'draft');
      if (!data) {
        return { success: false, error: '没有找到已保存的草稿' };
      }
      
      const draft = JSON.parse(data);
      return {
        success: true,
        data: draft,
        timestamp: draft.timestamp
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  clearDraft() {
    try {
      localStorage.removeItem(this.prefix + 'draft');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  hasDraft() {
    return localStorage.getItem(this.prefix + 'draft') !== null;
  }

  saveLastSimulation(result) {
    try {
      const data = {
        timestamp: Date.now(),
        routes: result.routes ? result.routes.map(r => r.toJSON ? r.toJSON() : r) : [],
        analysis: result.analysis || null,
        hotspots: result.hotspots || [],
        suggestions: result.suggestions ? result.suggestions.map(s => ({
          type: s.type,
          skuCode: s.skuCode,
          skuName: s.skuName,
          currentLocation: s.currentLocation,
          suggestedLocation: s.suggestedLocation,
          reason: s.reason,
          estimatedSaving: s.estimatedSaving
        })) : [],
        inventoryCheck: result.inventoryCheck || null
      };
      
      localStorage.setItem(this.prefix + 'last_simulation', JSON.stringify(data));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  loadLastSimulation() {
    try {
      const data = localStorage.getItem(this.prefix + 'last_simulation');
      if (!data) {
        return null;
      }
      return JSON.parse(data);
    } catch (err) {
      return null;
    }
  }

  saveSettings(settings) {
    try {
      localStorage.setItem(this.prefix + 'settings', JSON.stringify(settings));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  loadSettings() {
    try {
      const data = localStorage.getItem(this.prefix + 'settings');
      if (!data) {
        return {
          pickerCount: 1,
          algorithm: 'nearest'
        };
      }
      return JSON.parse(data);
    } catch (err) {
      return {
        pickerCount: 1,
        algorithm: 'nearest'
      };
    }
  }

  exportAll() {
    return {
      draft: this.loadDraft(),
      lastSimulation: this.loadLastSimulation(),
      settings: this.loadSettings()
    };
  }

  importAll(data) {
    try {
      if (data.draft && data.draft.success) {
        localStorage.setItem(this.prefix + 'draft', JSON.stringify(data.draft.data));
      }
      if (data.lastSimulation) {
        localStorage.setItem(this.prefix + 'last_simulation', JSON.stringify(data.lastSimulation));
      }
      if (data.settings) {
        localStorage.setItem(this.prefix + 'settings', JSON.stringify(data.settings));
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}
