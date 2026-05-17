class Deduplicator {
  deduplicate(endpoints) {
    const seen = new Map();
    const duplicates = [];
    
    for (const endpoint of endpoints) {
      const key = this._generateKey(endpoint);
      
      if (seen.has(key)) {
        const first = seen.get(key);
        duplicates.push({
          endpoint: {
            method: endpoint.method,
            path: endpoint.path
          },
          firstSource: first.source,
          duplicateSource: endpoint.source
        });
      } else {
        seen.set(key, endpoint);
      }
    }
    
    return {
      endpoints: Array.from(seen.values()),
      duplicates
    };
  }

  _generateKey(endpoint) {
    return `${endpoint.method.toUpperCase()}:${endpoint.path}`;
  }
}

module.exports = {
  Deduplicator
};
