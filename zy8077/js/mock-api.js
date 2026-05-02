class MockApiService {
  constructor() {
    this.data = new Map();
    this.listeners = [];
    this.isOnline = true;
    this.latency = 500;
  }

  setOnline(online) {
    this.isOnline = online;
    this.notifyListeners();
  }

  setLatency(ms) {
    this.latency = ms;
  }

  async delay() {
    return new Promise(resolve => setTimeout(resolve, this.latency));
  }

  checkOnline() {
    if (!this.isOnline) {
      const error = new Error('网络不可用');
      error.status = 0;
      throw error;
    }
  }

  async createInspection(inspection) {
    this.checkOnline();
    await this.delay();
    
    const id = inspection.id || `inspection_${Date.now()}`;
    const newInspection = {
      ...inspection,
      id,
      createdAt: inspection.createdAt || Date.now(),
      lastModified: Date.now(),
      version: 1
    };
    
    this.data.set(id, newInspection);
    this.notifyListeners();
    return { ...newInspection };
  }

  async getInspection(id) {
    this.checkOnline();
    await this.delay();
    
    const inspection = this.data.get(id);
    if (!inspection) {
      const error = new Error('未找到');
      error.status = 404;
      throw error;
    }
    return { ...inspection };
  }

  async getAllInspections() {
    this.checkOnline();
    await this.delay();
    
    return Array.from(this.data.values()).map(i => ({ ...i }));
  }

  async updateInspection(inspection) {
    this.checkOnline();
    await this.delay();
    
    const existing = this.data.get(inspection.id);
    if (!existing) {
      const error = new Error('未找到');
      error.status = 404;
      throw error;
    }
    
    const updated = {
      ...existing,
      ...inspection,
      lastModified: Date.now(),
      version: inspection.version || existing.version + 1
    };
    
    this.data.set(inspection.id, updated);
    this.notifyListeners();
    return { ...updated };
  }

  async deleteInspection(id) {
    this.checkOnline();
    await this.delay();
    
    if (!this.data.has(id)) {
      const error = new Error('未找到');
      error.status = 404;
      throw error;
    }
    
    this.data.delete(id);
    this.notifyListeners();
    return { success: true };
  }

  reset() {
    this.data.clear();
    this.notifyListeners();
  }

  loadSampleData(sampleData) {
    sampleData.forEach(item => {
      this.data.set(item.id, { ...item });
    });
    this.notifyListeners();
  }

  getSnapshot() {
    return Array.from(this.data.values()).map(i => ({ ...i }));
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback());
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MockApiService };
} else {
  window.MockApiService = MockApiService;
}
