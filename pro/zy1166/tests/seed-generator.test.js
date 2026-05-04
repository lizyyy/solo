const { describe, it, beforeEach } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SeedGenerator = require('../src/utils/seed-generator');

describe('SeedGenerator', () => {
  describe('generate()', () => {
    it('should generate good sample data', () => {
      const data = SeedGenerator.generate('good');
      
      assert.ok(data.gcLog);
      assert.ok(data.heapSummary);
      assert.ok(data.retainerPaths);
      assert.ok(data.trafficCSV);
      assert.ok(data.config);
    });

    it('should generate bad sample data', () => {
      const data = SeedGenerator.generate('bad');
      
      assert.ok(data.gcLog);
      assert.ok(data.heapSummary);
      assert.ok(data.retainerPaths);
      assert.ok(data.trafficCSV);
      assert.ok(data.config);
    });

    it('should generate different data for good vs bad', () => {
      const goodData = SeedGenerator.generate('good');
      const badData = SeedGenerator.generate('bad');
      
      assert.notStrictEqual(goodData.gcLog, badData.gcLog);
    });
  });

  describe('generateGoodGCLog()', () => {
    it('should contain Scavenge events', () => {
      const log = SeedGenerator.generateGoodGCLog();
      assert.ok(log.includes('Scavenge'));
    });

    it('should contain Mark-Sweep events', () => {
      const log = SeedGenerator.generateGoodGCLog();
      assert.ok(log.includes('Mark-Sweep'));
    });

    it('should have reasonable survival rates', () => {
      const log = SeedGenerator.generateGoodGCLog();
      const matches = log.match(/Survival rate: (\d+\.\d+)%/g);
      if (matches) {
        const rates = matches.map(m => parseFloat(m.match(/(\d+\.\d+)%/)[1]));
        const highRates = rates.filter(r => r > 60);
        assert.ok(highRates.length < rates.length * 0.3, 'Most survival rates should be < 60%');
      }
    });
  });

  describe('generateBadGCLog()', () => {
    it('should contain Scavenge events with HIGH promotion', () => {
      const log = SeedGenerator.generateBadGCLog();
      assert.ok(log.includes('Promoted'));
      assert.ok(log.includes('HIGH!'));
    });

    it('should have low reclamation rates', () => {
      const log = SeedGenerator.generateBadGCLog();
      assert.ok(log.includes('LOW!'));
    });
  });

  describe('generateGoodHeapSummary()', () => {
    it('should have reasonable heap usage', () => {
      const summary = SeedGenerator.generateGoodHeapSummary();
      assert.ok(summary.stats.heapUsagePercent < 50);
    });

    it('should have few or no large objects', () => {
      const summary = SeedGenerator.generateGoodHeapSummary();
      assert.ok(summary.largeObjects.length === 0);
    });

    it('should have few potential leaks', () => {
      const summary = SeedGenerator.generateGoodHeapSummary();
      assert.ok(summary.stats.potentialLeakCount === 0);
    });
  });

  describe('generateBadHeapSummary()', () => {
    it('should have high heap usage', () => {
      const summary = SeedGenerator.generateBadHeapSummary();
      assert.ok(summary.stats.heapUsagePercent > 80);
    });

    it('should have large objects', () => {
      const summary = SeedGenerator.generateBadHeapSummary();
      assert.ok(summary.largeObjects.length > 0);
    });

    it('should have many buffers', () => {
      const summary = SeedGenerator.generateBadHeapSummary();
      assert.ok(summary.bufferAnalysis.totalBuffers > 1000);
    });

    it('should have potential leaks', () => {
      const summary = SeedGenerator.generateBadHeapSummary();
      assert.ok(summary.stats.potentialLeakCount > 0);
    });
  });

  describe('generateGoodRetainerPaths()', () => {
    it('should have no suspicious paths', () => {
      const paths = SeedGenerator.generateGoodRetainerPaths();
      assert.ok(paths.suspiciousPaths.length === 0);
    });
  });

  describe('generateBadRetainerPaths()', () => {
    it('should have suspicious paths', () => {
      const paths = SeedGenerator.generateBadRetainerPaths();
      assert.ok(paths.suspiciousPaths.length > 0);
    });

    it('should have critical paths from event listeners', () => {
      const paths = SeedGenerator.generateBadRetainerPaths();
      const criticalPaths = paths.suspiciousPaths.filter(p => p.highestSeverity === 'critical');
      assert.ok(criticalPaths.length > 0);
    });

    it('should have paths matching closure/event listener patterns', () => {
      const paths = SeedGenerator.generateBadRetainerPaths();
      const hasEventListener = paths.suspiciousPaths.some(p => 
        p.matchedPatterns.some(mp => mp.name === '事件监听器')
      );
      assert.ok(hasEventListener);
    });
  });

  describe('generateGoodConfig()', () => {
    it('should have no issues', () => {
      const config = SeedGenerator.generateGoodConfig();
      assert.ok(config.summary.overview.totalIssues === 0);
    });

    it('should have bounded caches', () => {
      const config = SeedGenerator.generateGoodConfig();
      config.caches.forEach(cache => {
        assert.ok(cache.maxSize !== Infinity);
        assert.ok(cache.ttl !== null);
      });
    });

    it('should have bounded object pools', () => {
      const config = SeedGenerator.generateGoodConfig();
      config.objectPools.forEach(pool => {
        assert.ok(pool.maxSize !== Infinity);
        assert.ok(pool.idleTimeout !== null);
      });
    });
  });

  describe('generateBadConfig()', () => {
    it('should have many issues', () => {
      const config = SeedGenerator.generateBadConfig();
      assert.ok(config.summary.overview.totalIssues > 0);
    });

    it('should have critical issues', () => {
      const config = SeedGenerator.generateBadConfig();
      assert.ok(config.summary.overview.criticalIssues > 0);
    });

    it('should have unbounded cache', () => {
      const config = SeedGenerator.generateBadConfig();
      const unboundedCache = config.caches.find(c => c.name === 'unboundedCache');
      assert.ok(unboundedCache);
      assert.strictEqual(unboundedCache.maxSize, Infinity);
      assert.strictEqual(unboundedCache.ttl, null);
    });

    it('should have unbounded object pool', () => {
      const config = SeedGenerator.generateBadConfig();
      const unboundedPool = config.objectPools.find(p => p.name === 'unboundedPool');
      assert.ok(unboundedPool);
      assert.strictEqual(unboundedPool.maxSize, Infinity);
    });

    it('should have weakRef usage issues', () => {
      const config = SeedGenerator.generateBadConfig();
      assert.ok(config.weakRefUsage.length > 0);
    });

    it('should have finalizationRegistry usage issues', () => {
      const config = SeedGenerator.generateBadConfig();
      assert.ok(config.finalizationRegistryUsage.length > 0);
    });
  });

  describe('generateGoodTrafficCSV()', () => {
    it('should have valid CSV format', () => {
      const csv = SeedGenerator.generateGoodTrafficCSV();
      const lines = csv.split('\n');
      assert.ok(lines.length > 1);
      
      const header = lines[0];
      assert.ok(header.includes('timestamp'));
      assert.ok(header.includes('endpoint'));
      assert.ok(header.includes('memory_before'));
    });

    it('should have multiple data rows', () => {
      const csv = SeedGenerator.generateGoodTrafficCSV();
      const lines = csv.split('\n');
      assert.ok(lines.length > 10);
    });
  });

  describe('generateBadTrafficCSV()', () => {
    it('should have more data points than good', () => {
      const goodCSV = SeedGenerator.generateGoodTrafficCSV();
      const badCSV = SeedGenerator.generateBadTrafficCSV();
      
      const goodLines = goodCSV.split('\n');
      const badLines = badCSV.split('\n');
      
      assert.ok(badLines.length >= goodLines.length);
    });

    it('should have valid CSV format', () => {
      const csv = SeedGenerator.generateBadTrafficCSV();
      const lines = csv.split('\n');
      assert.ok(lines.length > 1);
      
      const header = lines[0];
      assert.ok(header.includes('timestamp'));
      assert.ok(header.includes('endpoint'));
    });
  });
});
