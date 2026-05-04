const fs = require('fs');

class HeapParser {
  constructor(filePath) {
    this.filePath = filePath;
  }

  parse() {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return this.analyzeHeap(data);
  }

  analyzeHeap(data) {
    const result = {
      meta: {
        generatedAt: data.generatedAt || new Date().toISOString(),
        heapSnapshotVersion: data.version || 'unknown'
      },
      summary: {
        totalHeapSize: 0,
        usedHeapSize: 0,
        heapSizeLimit: 0,
        totalJSHeapSize: 0,
        usedJSHeapSize: 0,
        jsHeapSizeLimit: 0
      },
      spaces: [],
      nodeTypes: [],
      dominantRetainers: [],
      potentialLeakIndicators: []
    };

    if (data.snapshot && data.snapshot.meta && data.snapshot.meta.node_types) {
      result.nodeTypes = data.snapshot.meta.node_types;
    }

    if (data.nodes) {
      const typeCounts = {};
      const typeSizes = {};
      
      for (const node of data.nodes) {
        const type = node.type || node.name;
        const size = node.self_size || node.size || 0;
        
        typeCounts[type] = (typeCounts[type] || 0) + 1;
        typeSizes[type] = (typeSizes[type] || 0) + size;
      }

      result.typeDistribution = Object.entries(typeCounts).map(([type, count]) => ({
        type,
        count,
        totalSize: typeSizes[type],
        avgSize: count > 0 ? Math.round(typeSizes[type] / count) : 0
      })).sort((a, b) => b.totalSize - a.totalSize);

      result.topTypes = result.typeDistribution.slice(0, 10);

      const largeObjects = data.nodes.filter(node => 
        (node.self_size || node.size || 0) > 1024 * 1024
      );
      result.largeObjects = largeObjects.map(node => ({
        type: node.type || node.name,
        size: node.self_size || node.size,
        id: node.id
      })).sort((a, b) => b.size - a.size);
    }

    if (data.spaces) {
      result.spaces = data.spaces.map(space => ({
        name: space.name,
        size: space.size || 0,
        usedSize: space.used_size || 0,
        availableSize: (space.size || 0) - (space.used_size || 0),
        usagePercent: space.size ? ((space.used_size || 0) / space.size * 100) : 0
      }));
    }

    const standardSummary = this.extractStandardSummary(data);
    result.summary = { ...result.summary, ...standardSummary };

    if (data.potentialLeaks || this.hasLeakIndicators(data)) {
      result.potentialLeakIndicators = this.identifyLeakIndicators(data);
    }

    if (data.dominators || data.nodes) {
      result.dominantRetainers = this.analyzeDominantRetainers(data);
    }

    if (data.natives || this.hasNativeMemory(data)) {
      result.nativeMemory = this.analyzeNativeMemory(data);
    }

    if (data.buffers || this.hasBufferObjects(data)) {
      result.bufferAnalysis = this.analyzeBufferObjects(data);
    }

    result.stats = this.calculateStats(result);

    return result;
  }

  extractStandardSummary(data) {
    const summary = {};

    if (data.totalHeapSize !== undefined) summary.totalHeapSize = data.totalHeapSize;
    if (data.usedHeapSize !== undefined) summary.usedHeapSize = data.usedHeapSize;
    if (data.heapSizeLimit !== undefined) summary.heapSizeLimit = data.heapSizeLimit;
    if (data.totalJSHeapSize !== undefined) summary.totalJSHeapSize = data.totalJSHeapSize;
    if (data.usedJSHeapSize !== undefined) summary.usedJSHeapSize = data.usedJSHeapSize;
    if (data.jsHeapSizeLimit !== undefined) summary.jsHeapSizeLimit = data.jsHeapSizeLimit;

    if (data.summary) {
      if (data.summary.total_heap_size !== undefined) summary.totalHeapSize = data.summary.total_heap_size;
      if (data.summary.used_heap_size !== undefined) summary.usedHeapSize = data.summary.used_heap_size;
      if (data.summary.total_js_heap_size !== undefined) summary.totalJSHeapSize = data.summary.total_js_heap_size;
      if (data.summary.used_js_heap_size !== undefined) summary.usedJSHeapSize = data.summary.used_js_heap_size;
    }

    return summary;
  }

  hasLeakIndicators(data) {
    if (data.potentialLeaks) return true;
    if (data.detachedNodes) return true;
    if (data.eventListeners) return true;
    if (data.closures) return true;
    if (data.timers) return true;
    return false;
  }

  identifyLeakIndicators(data) {
    const indicators = [];

    if (data.potentialLeaks) {
      indicators.push({
        type: 'potential_leaks',
        count: data.potentialLeaks.length,
        details: data.potentialLeaks
      });
    }

    if (data.detachedNodes) {
      indicators.push({
        type: 'detached_nodes',
        count: data.detachedNodes.length,
        details: data.detachedNodes.slice(0, 20)
      });
    }

    if (data.eventListeners) {
      indicators.push({
        type: 'event_listeners',
        count: data.eventListeners.length,
        details: data.eventListeners.slice(0, 20)
      });
    }

    if (data.closures) {
      indicators.push({
        type: 'closures',
        count: data.closures.length,
        details: data.closures.slice(0, 20)
      });
    }

    if (data.timers) {
      indicators.push({
        type: 'timers',
        count: data.timers.length,
        details: data.timers.slice(0, 20)
      });
    }

    if (data.weakRefs) {
      indicators.push({
        type: 'weak_refs',
        count: data.weakRefs.length,
        details: data.weakRefs.slice(0, 20)
      });
    }

    if (data.finalizationRegistry) {
      indicators.push({
        type: 'finalization_registry',
        count: data.finalizationRegistry.length,
        details: data.finalizationRegistry.slice(0, 20)
      });
    }

    return indicators;
  }

  analyzeDominantRetainers(data) {
    if (data.dominators) {
      return data.dominators.slice(0, 20).map(dom => ({
        id: dom.id,
        type: dom.type,
        name: dom.name,
        retainedSize: dom.retained_size || dom.retainedSize,
        selfSize: dom.self_size || dom.selfSize
      })).sort((a, b) => b.retainedSize - a.retainedSize);
    }

    if (data.nodes && data.edges) {
      const retainerMap = new Map();
      
      for (const edge of data.edges) {
        if (edge.type === 'property' || edge.type === 'element') {
          const targetId = edge.to_node || edge.target;
          const sourceId = edge.from_node || edge.source;
          
          if (!retainerMap.has(targetId)) {
            retainerMap.set(targetId, []);
          }
          retainerMap.get(targetId).push(sourceId);
        }
      }

      const dominantNodes = [];
      for (const node of data.nodes) {
        const retainers = retainerMap.get(node.id) || [];
        if (retainers.length > 0) {
          dominantNodes.push({
            id: node.id,
            type: node.type || node.name,
            retainerCount: retainers.length,
            selfSize: node.self_size || node.size || 0
          });
        }
      }

      return dominantNodes.sort((a, b) => b.retainerCount - a.retainerCount).slice(0, 20);
    }

    return [];
  }

  hasNativeMemory(data) {
    if (data.natives) return true;
    if (data.nativeMemory) return true;
    if (data.externalMemory) return true;
    return false;
  }

  analyzeNativeMemory(data) {
    const result = {
      totalExternal: 0,
      categories: []
    };

    if (data.externalMemory) {
      result.totalExternal = data.externalMemory;
    }

    if (data.natives) {
      const categoryMap = {};
      for (const native of data.natives) {
        const type = native.type || 'unknown';
        if (!categoryMap[type]) {
          categoryMap[type] = { count: 0, totalSize: 0 };
        }
        categoryMap[type].count++;
        categoryMap[type].totalSize += native.size || 0;
      }
      result.categories = Object.entries(categoryMap).map(([type, stats]) => ({
        type,
        count: stats.count,
        totalSize: stats.totalSize,
        avgSize: stats.count > 0 ? Math.round(stats.totalSize / stats.count) : 0
      })).sort((a, b) => b.totalSize - a.totalSize);
    }

    return result;
  }

  hasBufferObjects(data) {
    if (data.buffers) return true;
    if (data.arrayBuffers) return true;
    if (data.nodes) {
      return data.nodes.some(node => 
        node.type === 'ArrayBuffer' || 
        node.type === 'Buffer' ||
        (node.name && (node.name.includes('Buffer') || node.name.includes('ArrayBuffer')))
      );
    }
    return false;
  }

  analyzeBufferObjects(data) {
    const result = {
      totalBuffers: 0,
      totalBufferSize: 0,
      avgBufferSize: 0,
      largestBuffer: 0,
      bufferTypes: []
    };

    if (data.buffers) {
      result.totalBuffers = data.buffers.length;
      result.totalBufferSize = data.buffers.reduce((sum, b) => sum + (b.size || 0), 0);
      result.avgBufferSize = result.totalBuffers > 0 ? Math.round(result.totalBufferSize / result.totalBuffers) : 0;
      result.largestBuffer = Math.max(...data.buffers.map(b => b.size || 0), 0);
    }

    if (data.nodes) {
      const bufferNodes = data.nodes.filter(node => 
        node.type === 'ArrayBuffer' || 
        node.type === 'Buffer' ||
        (node.name && (node.name.includes('Buffer') || node.name.includes('ArrayBuffer')))
      );

      if (bufferNodes.length > 0) {
        result.totalBuffers += bufferNodes.length;
        result.totalBufferSize += bufferNodes.reduce((sum, n) => sum + (n.self_size || n.size || 0), 0);
        result.avgBufferSize = result.totalBuffers > 0 ? Math.round(result.totalBufferSize / result.totalBuffers) : 0;
        result.largestBuffer = Math.max(result.largestBuffer, ...bufferNodes.map(n => n.self_size || n.size || 0), 0);
      }
    }

    return result;
  }

  calculateStats(result) {
    const stats = {
      heapUsagePercent: 0,
      jsHeapUsagePercent: 0,
      spaceWithHighestUsage: null,
      largestType: null,
      totalLargeObjects: 0,
      potentialLeakCount: 0
    };

    if (result.summary.totalHeapSize > 0) {
      stats.heapUsagePercent = (result.summary.usedHeapSize / result.summary.totalHeapSize) * 100;
    }

    if (result.summary.totalJSHeapSize > 0) {
      stats.jsHeapUsagePercent = (result.summary.usedJSHeapSize / result.summary.totalJSHeapSize) * 100;
    }

    if (result.spaces.length > 0) {
      stats.spaceWithHighestUsage = result.spaces.reduce((max, space) => 
        space.usagePercent > max.usagePercent ? space : max
      , result.spaces[0]);
    }

    if (result.typeDistribution && result.typeDistribution.length > 0) {
      stats.largestType = result.typeDistribution[0];
    }

    if (result.largeObjects) {
      stats.totalLargeObjects = result.largeObjects.length;
    }

    if (result.potentialLeakIndicators) {
      stats.potentialLeakCount = result.potentialLeakIndicators.reduce((sum, indicator) => 
        sum + (indicator.count || 0), 0);
    }

    return stats;
  }
}

module.exports = HeapParser;
