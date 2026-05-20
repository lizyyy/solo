const { Service, DependencyEndpoint, CheckItem, FailureSample, StatusTimeline } = require('./models');

class DataStore {
  constructor() {
    this.services = new Map();
    this.dependencies = new Map();
    this.checkItems = new Map();
    this.failureSamples = new Map();
    this.statusTimeline = new Map();
  }

  addService(data) {
    const service = new Service(data);
    this.services.set(service.id, service);
    return service;
  }

  getService(id) {
    return this.services.get(id);
  }

  getAllServices(filters = {}) {
    let results = Array.from(this.services.values());
    
    if (filters.status) {
      results = results.filter(s => s.status === filters.status);
    }
    if (filters.owner) {
      results = results.filter(s => s.owner === filters.owner);
    }
    if (filters.tag) {
      results = results.filter(s => s.tags.includes(filters.tag));
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      results = results.filter(s => 
        s.name.toLowerCase().includes(search) || 
        s.description.toLowerCase().includes(search)
      );
    }
    
    return results;
  }

  updateService(id, updates) {
    const service = this.services.get(id);
    if (!service) return null;
    Object.assign(service, updates, { updatedAt: new Date() });
    return service;
  }

  deleteService(id) {
    return this.services.delete(id);
  }

  addDependency(data) {
    const dependency = new DependencyEndpoint(data);
    this.dependencies.set(dependency.id, dependency);
    return dependency;
  }

  getDependency(id) {
    return this.dependencies.get(id);
  }

  getDependenciesByService(serviceId) {
    return Array.from(this.dependencies.values()).filter(d => d.serviceId === serviceId);
  }

  getAllDependencies() {
    return Array.from(this.dependencies.values());
  }

  updateDependency(id, updates) {
    const dependency = this.dependencies.get(id);
    if (!dependency) return null;
    Object.assign(dependency, updates, { updatedAt: new Date() });
    return dependency;
  }

  addCheckItem(data) {
    const checkItem = new CheckItem(data);
    this.checkItems.set(checkItem.id, checkItem);
    return checkItem;
  }

  getCheckItemsByService(serviceId) {
    return Array.from(this.checkItems.values()).filter(c => c.serviceId === serviceId);
  }

  getCheckItemsByDependency(dependencyId) {
    return Array.from(this.checkItems.values()).filter(c => c.dependencyId === dependencyId);
  }

  addFailureSample(data) {
    const sample = new FailureSample(data);
    this.failureSamples.set(sample.id, sample);
    return sample;
  }

  getFailureSamplesByService(serviceId, limit = 50) {
    return Array.from(this.failureSamples.values())
      .filter(s => s.serviceId === serviceId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getFailureSamplesByDependency(dependencyId, limit = 50) {
    return Array.from(this.failureSamples.values())
      .filter(s => s.dependencyId === dependencyId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  addStatusTimeline(data) {
    const timeline = new StatusTimeline(data);
    this.statusTimeline.set(timeline.id, timeline);
    return timeline;
  }

  getStatusTimelineByService(serviceId, limit = 100) {
    return Array.from(this.statusTimeline.values())
      .filter(t => t.serviceId === serviceId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  clear() {
    this.services.clear();
    this.dependencies.clear();
    this.checkItems.clear();
    this.failureSamples.clear();
    this.statusTimeline.clear();
  }
}

module.exports = new DataStore();
