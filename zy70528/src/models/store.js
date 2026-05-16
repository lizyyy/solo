const Strategy = require('./Strategy');

class StrategyStore {
  constructor() {
    this.strategies = new Map();
  }

  create(data) {
    const strategy = new Strategy(data);
    this.strategies.set(strategy.id, strategy);
    return strategy;
  }

  findById(id) {
    return this.strategies.get(id);
  }

  findAll(filters = {}) {
    let results = Array.from(this.strategies.values());

    if (filters.status) {
      results = results.filter(s => s.status === filters.status);
    }

    if (filters.degradationLevel) {
      results = results.filter(s => s.degradationLevel === filters.degradationLevel);
    }

    if (filters.strategyName) {
      results = results.filter(s => 
        s.strategyName.toLowerCase().includes(filters.strategyName.toLowerCase())
      );
    }

    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  update(id, data) {
    const strategy = this.strategies.get(id);
    if (!strategy) return null;

    Object.keys(data).forEach(key => {
      if (key !== 'id' && key !== 'createdAt') {
        strategy[key] = data[key];
      }
    });
    strategy.updatedAt = new Date().toISOString();

    return strategy;
  }

  delete(id) {
    return this.strategies.delete(id);
  }

  matchStrategy(apiGroup, tenantId) {
    return Array.from(this.strategies.values()).filter(strategy => {
      if (strategy.status !== 'blocked') return false;

      const apiMatch = strategy.apiGroups.length === 0 || 
        strategy.apiGroups.includes(apiGroup) ||
        strategy.apiGroups.some(g => apiGroup.startsWith(g));

      let tenantMatch = false;
      if (strategy.tenantScope.type === 'all') {
        tenantMatch = true;
      } else if (strategy.tenantScope.type === 'include') {
        tenantMatch = strategy.tenantScope.tenants.includes(tenantId);
      } else if (strategy.tenantScope.type === 'exclude') {
        tenantMatch = !strategy.tenantScope.tenants.includes(tenantId);
      }

      return apiMatch && tenantMatch;
    });
  }

  getStatistics() {
    const stats = {
      total: this.strategies.size,
      byStatus: {},
      byLevel: {},
      activeCount: 0
    };

    this.strategies.forEach(strategy => {
      stats.byStatus[strategy.status] = (stats.byStatus[strategy.status] || 0) + 1;
      stats.byLevel[strategy.degradationLevel] = (stats.byLevel[strategy.degradationLevel] || 0) + 1;
      if (strategy.status === 'blocked') {
        stats.activeCount++;
      }
    });

    return stats;
  }
}

module.exports = new StrategyStore();
