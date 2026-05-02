class Conflict {
  constructor(localData, serverData, field, resolution = null) {
    this.localData = localData;
    this.serverData = serverData;
    this.field = field;
    this.resolution = resolution;
    this.resolved = false;
  }
}

class ConflictResolver {
  constructor(strategy = 'last-write-wins') {
    this.strategy = strategy;
    this.conflicts = [];
    this.listeners = [];
  }

  detectConflicts(localData, serverData) {
    const conflicts = [];
    const fields = ['notes', 'abnormalItems', 'photos', 'status', 'inspector', 'date'];

    for (const field of fields) {
      const localValue = JSON.stringify(localData[field]);
      const serverValue = JSON.stringify(serverData[field]);
      if (localValue !== serverValue) {
        conflicts.push(new Conflict(localData, serverData, field));
      }
    }

    return conflicts;
  }

  async resolve(localData, serverData) {
    const conflicts = this.detectConflicts(localData, serverData);
    
    if (conflicts.length === 0) {
      return localData;
    }

    this.conflicts = conflicts;
    this.notifyListeners();

    switch (this.strategy) {
      case 'last-write-wins':
        return this.resolveLastWriteWins(localData, serverData, conflicts);
      case 'server-wins':
        return this.resolveServerWins(localData, serverData, conflicts);
      case 'local-wins':
        return this.resolveLocalWins(localData, serverData, conflicts);
      case 'manual':
        return await this.resolveManual(localData, serverData, conflicts);
      default:
        return this.resolveLastWriteWins(localData, serverData, conflicts);
    }
  }

  resolveLastWriteWins(localData, serverData, conflicts) {
    const resolved = { ...serverData };
    
    for (const conflict of conflicts) {
      if (localData.lastModified > serverData.lastModified) {
        resolved[conflict.field] = localData[conflict.field];
      }
      conflict.resolution = localData.lastModified > serverData.lastModified ? 'local' : 'server';
      conflict.resolved = true;
    }

    resolved.version = Math.max(localData.version, serverData.version) + 1;
    resolved.lastModified = Date.now();
    
    this.notifyListeners();
    return resolved;
  }

  resolveServerWins(localData, serverData, conflicts) {
    const resolved = { ...serverData };
    
    for (const conflict of conflicts) {
      conflict.resolution = 'server';
      conflict.resolved = true;
    }

    resolved.version = Math.max(localData.version, serverData.version) + 1;
    resolved.lastModified = Date.now();
    
    this.notifyListeners();
    return resolved;
  }

  resolveLocalWins(localData, serverData, conflicts) {
    const resolved = { ...localData };
    
    for (const conflict of conflicts) {
      conflict.resolution = 'local';
      conflict.resolved = true;
    }

    resolved.version = Math.max(localData.version, serverData.version) + 1;
    resolved.lastModified = Date.now();
    
    this.notifyListeners();
    return resolved;
  }

  async resolveManual(localData, serverData, conflicts) {
    return new Promise((resolve) => {
      this.manualResolveCallback = (resolutions) => {
        const resolved = { ...serverData };
        
        for (const conflict of conflicts) {
          const resolution = resolutions[conflict.field];
          if (resolution === 'local') {
            resolved[conflict.field] = localData[conflict.field];
          }
          conflict.resolution = resolution;
          conflict.resolved = true;
        }

        resolved.version = Math.max(localData.version, serverData.version) + 1;
        resolved.lastModified = Date.now();
        
        this.notifyListeners();
        resolve(resolved);
      };
    });
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.conflicts));
  }

  getConflicts() {
    return this.conflicts;
  }

  clearConflicts() {
    this.conflicts = [];
    this.notifyListeners();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConflictResolver, Conflict };
} else {
  window.ConflictResolver = ConflictResolver;
  window.Conflict = Conflict;
}
