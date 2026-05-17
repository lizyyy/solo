const { groupBy, sumBy, sortBySize } = require('./utils');

class BundleAnalyzer {
  constructor(config) {
    this.config = config;
  }

  analyze(scanResult) {
    const { chunks, modules, anomalies } = scanResult;

    const totalSize = sumBy(chunks, c => c.size);
    const totalGzippedSize = sumBy(chunks, c => c.gzippedSize || 0);

    const dependencies = this.aggregateByPackage(modules);
    const chunksBySize = sortBySize(chunks);
    const modulesBySize = sortBySize(modules).slice(0, 50);

    const summary = {
      totalChunks: chunks.length,
      totalModules: modules.length,
      totalSize,
      totalGzippedSize,
      dependenciesCount: Object.keys(dependencies).length,
      anomaliesCount: anomalies.length,
      largestChunk: chunksBySize[0],
      largestDependency: Object.values(dependencies)[0]
    };

    return {
      summary,
      chunks: chunksBySize,
      modules: modulesBySize,
      dependencies,
      dependenciesArray: sortBySize(Object.values(dependencies)),
      anomalies
    };
  }

  aggregateByPackage(modules) {
    const byPackage = groupBy(modules, m => m.package);
    
    const aggregated = {};
    for (const [pkgName, pkgModules] of Object.entries(byPackage)) {
      const size = sumBy(pkgModules, m => m.size);
      const chunks = [...new Set(pkgModules.map(m => m.chunk))];
      
      aggregated[pkgName] = {
        name: pkgName,
        size,
        modulesCount: pkgModules.length,
        chunksCount: chunks.length,
        chunks,
        modules: sortBySize(pkgModules).slice(0, 10),
        isExternal: !pkgName.startsWith('(')
      };
    }

    const sorted = {};
    Object.keys(aggregated)
      .sort((a, b) => aggregated[b].size - aggregated[a].size)
      .forEach(key => { sorted[key] = aggregated[key]; });

    return sorted;
  }

  calculatePercentages(items, totalSize) {
    return items.map(item => ({
      ...item,
      percentage: item.size / totalSize
    }));
  }
}

module.exports = BundleAnalyzer;
