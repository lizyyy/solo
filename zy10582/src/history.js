const fs = require('fs');
const path = require('path');
const { ensureDir, getTimestamp, safeRequire, sortBySize } = require('./utils');

class HistoryManager {
  constructor(config) {
    this.config = config;
    this.historyDir = path.join(config.outputDir, 'history');
  }

  save(result) {
    if (!this.config.keepHistory) return null;

    ensureDir(this.historyDir);

    const timestamp = getTimestamp();
    const filename = `${this.config.reportName}-${timestamp}.json`;
    const filepath = path.join(this.historyDir, filename);

    const historyEntry = {
      timestamp: new Date().toISOString(),
      summary: result.summary,
      dependencies: result.dependenciesArray.slice(0, 100).map(d => ({
        name: d.name,
        size: d.size,
        modulesCount: d.modulesCount
      }))
    };

    fs.writeFileSync(filepath, JSON.stringify(historyEntry, null, 2), 'utf-8');

    this.cleanupOldHistory();

    return filepath;
  }

  cleanupOldHistory() {
    const files = fs.readdirSync(this.historyDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > this.config.historyLimit) {
      files.slice(this.config.historyLimit).forEach(file => {
        fs.unlinkSync(path.join(this.historyDir, file));
      });
    }
  }

  getLatest() {
    const files = this.getHistoryFiles();
    if (files.length === 0) return null;

    const latestFile = files[0];
    return safeRequire(path.join(this.historyDir, latestFile));
  }

  getHistoryFiles() {
    if (!fs.existsSync(this.historyDir)) return [];

    return fs.readdirSync(this.historyDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
  }

  compare(currentResult) {
    const previous = this.getLatest();
    if (!previous) {
      return { hasComparison: false, changes: [] };
    }

    const currentDeps = {};
    currentResult.dependenciesArray.forEach(d => {
      currentDeps[d.name] = d.size;
    });

    const previousDeps = {};
    previous.dependencies.forEach(d => {
      previousDeps[d.name] = d.size;
    });

    const allNames = [...new Set([...Object.keys(currentDeps), ...Object.keys(previousDeps)])];

    const changes = [];
    allNames.forEach(name => {
      const currentSize = currentDeps[name] || 0;
      const previousSize = previousDeps[name] || 0;
      const diff = currentSize - previousSize;
      const diffPercent = previousSize > 0 ? diff / previousSize : 0;

      changes.push({
        name,
        previousSize,
        currentSize,
        diff,
        diffPercent,
        type: diff > 0 ? 'increased' : diff < 0 ? 'decreased' : 'unchanged',
        isNew: previousSize === 0,
        isRemoved: currentSize === 0
      });
    });

    const sortedChanges = sortBySize(changes.map(c => ({ ...c, size: Math.abs(c.diff) })))
      .map(c => ({ ...c, size: undefined }));

    const totalPreviousSize = previous.summary.totalSize;
    const totalCurrentSize = currentResult.summary.totalSize;
    const totalDiff = totalCurrentSize - totalPreviousSize;

    return {
      hasComparison: true,
      previousTimestamp: previous.timestamp,
      totals: {
        previous: totalPreviousSize,
        current: totalCurrentSize,
        diff: totalDiff,
        diffPercent: totalPreviousSize > 0 ? totalDiff / totalPreviousSize : 0
      },
      changes: sortedChanges,
      newDependencies: sortedChanges.filter(c => c.isNew),
      removedDependencies: sortedChanges.filter(c => c.isRemoved),
      increasedDependencies: sortedChanges.filter(c => c.diff > 0 && !c.isNew),
      decreasedDependencies: sortedChanges.filter(c => c.diff < 0 && !c.isRemoved)
    };
  }
}

module.exports = HistoryManager;
