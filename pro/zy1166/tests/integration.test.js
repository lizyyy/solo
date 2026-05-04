const { describe, it, beforeEach } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SeedGenerator = require('../src/utils/seed-generator');
const GCParser = require('../src/parsers/gc-parser');
const HeapParser = require('../src/parsers/heap-parser');
const RetainerParser = require('../src/parsers/retainer-parser');
const ConfigParser = require('../src/parsers/config-parser');
const Detector = require('../src/detectors/detector');
const Simulator = require('../src/simulator/simulator');
const Reporter = require('../src/reporters/reporter');

const TEST_DATA_DIR = path.join(__dirname, 'test-data');

describe('Integration Tests', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  });

  describe('Full analysis pipeline with bad sample', () => {
    it('should parse GC log correctly', () => {
      const badData = SeedGenerator.generate('bad');
      
      const gcLogPath = path.join(TEST_DATA_DIR, 'trace-gc.log');
      fs.writeFileSync(gcLogPath, badData.gcLog);
      
      const gcParser = new GCParser(gcLogPath);
      const result = gcParser.parse();
      
      assert.ok(result.events, 'Should have events array');
      assert.ok(result.events.length > 0, 'Should have parsed events');
      assert.ok(result.stats, 'Should have stats');
      assert.ok(result.summary, 'Should have summary');
      
      console.log(`  Parsed ${result.events.length} GC events`);
      console.log(`  Total GC time: ${result.stats.totalGCTime.toFixed(3)} secs`);
    });

    it('should detect memory issues in bad sample', () => {
      const badData = SeedGenerator.generate('bad');
      
      const analysisData = {
        meta: {
          analysisTime: new Date().toISOString(),
          toolVersion: '1.0.0'
        },
        heapSummary: badData.heapSummary,
        retainerPaths: badData.retainerPaths,
        config: badData.config,
        issues: [],
        simulations: null,
        recommendations: []
      };
      
      const detector = new Detector(analysisData);
      const issues = detector.detectAll();
      
      assert.ok(Array.isArray(issues), 'Issues should be an array');
      
      const criticalIssues = issues.filter(i => i.severity === 'critical');
      const warningIssues = issues.filter(i => i.severity === 'warning');
      
      console.log(`  Detected ${issues.length} issues:`);
      console.log(`    Critical: ${criticalIssues.length}`);
      console.log(`    Warning: ${warningIssues.length}`);
      
      issues.forEach(issue => {
        console.log(`    - [${issue.severity.toUpperCase()}] ${issue.type}`);
      });
      
      assert.ok(criticalIssues.length > 0, 'Bad sample should have critical issues');
    });

    it('should run simulations on bad sample', () => {
      const badData = SeedGenerator.generate('bad');
      
      const analysisData = {
        meta: {
          analysisTime: new Date().toISOString(),
          toolVersion: '1.0.0'
        },
        config: badData.config,
        heapSummary: badData.heapSummary,
        issues: [],
        simulations: null,
        recommendations: []
      };
      
      const simulator = new Simulator(analysisData);
      
      const result = simulator.simulate({ maxOldSpaceSize: 1024 });
      
      assert.ok(result, 'Should have simulation result');
      assert.ok(result.estimatedPeakMemoryMB > 0, 'Should have peak memory estimate');
      assert.ok(result.riskLevel, 'Should have risk level');
      
      console.log(`  Simulation result:`);
      console.log(`    Peak memory: ${result.estimatedPeakMemoryMB.toFixed(1)} MB`);
      console.log(`    Risk level: ${result.riskLevel}`);
      console.log(`    GC frequency: ${result.gcFrequency.toFixed(2)}/min`);
    });

    it('should run all simulations', () => {
      const badData = SeedGenerator.generate('bad');
      
      const analysisData = {
        meta: {
          analysisTime: new Date().toISOString(),
          toolVersion: '1.0.0'
        },
        config: badData.config,
        heapSummary: badData.heapSummary,
        issues: [],
        simulations: null,
        recommendations: []
      };
      
      const simulator = new Simulator(analysisData);
      const simulations = simulator.runAllSimulations();
      
      assert.ok(simulations.v8Flags, 'Should have v8Flags simulations');
      assert.ok(simulations.cache, 'Should have cache simulations');
      assert.ok(simulations.objectPool, 'Should have objectPool simulations');
      assert.ok(simulations.batchProcessing, 'Should have batchProcessing simulations');
      
      assert.ok(Array.isArray(simulations.v8Flags.scenarios), 'v8Flags should have scenarios');
      assert.ok(simulations.v8Flags.scenarios.length > 0, 'v8Flags should have at least one scenario');
      
      console.log(`  All simulations:`);
      console.log(`    V8 Flags scenarios: ${simulations.v8Flags.scenarios.length}`);
      console.log(`    Cache scenarios: ${simulations.cache.scenarios.length}`);
      console.log(`    Object Pool scenarios: ${simulations.objectPool.scenarios.length}`);
      console.log(`    Batch Processing scenarios: ${simulations.batchProcessing.scenarios.length}`);
      
      simulations.v8Flags.scenarios.slice(0, 3).forEach(s => {
        console.log(`    - ${s.label}: peak=${s.result.estimatedPeakMemoryMB.toFixed(1)}MB, risk=${s.result.riskLevel}`);
      });
    });

    it('should get recommendations', () => {
      const badData = SeedGenerator.generate('bad');
      
      const analysisData = {
        meta: {
          analysisTime: new Date().toISOString(),
          toolVersion: '1.0.0'
        },
        config: badData.config,
        heapSummary: badData.heapSummary,
        issues: [],
        simulations: null,
        recommendations: []
      };
      
      const simulator = new Simulator(analysisData);
      const recommendations = simulator.getRecommendations();
      
      assert.ok(Array.isArray(recommendations), 'Should have recommendations array');
      assert.ok(recommendations.length > 0, 'Should have at least one recommendation');
      
      console.log(`  Recommendations: ${recommendations.length}`);
      recommendations.slice(0, 3).forEach((r, i) => {
        console.log(`    ${i + 1}. [${r.priority}] ${r.title}`);
      });
    });
  });

  describe('Full analysis pipeline with good sample', () => {
    it('should detect few or no critical issues in good sample', () => {
      const goodData = SeedGenerator.generate('good');
      
      const analysisData = {
        meta: {
          analysisTime: new Date().toISOString(),
          toolVersion: '1.0.0'
        },
        heapSummary: goodData.heapSummary,
        retainerPaths: goodData.retainerPaths,
        config: goodData.config,
        issues: [],
        simulations: null,
        recommendations: []
      };
      
      const detector = new Detector(analysisData);
      const issues = detector.detectAll();
      
      const criticalIssues = issues.filter(i => i.severity === 'critical');
      
      console.log(`  Good sample analysis:`);
      console.log(`    Total issues: ${issues.length}`);
      console.log(`    Critical issues: ${criticalIssues.length}`);
      
      assert.strictEqual(criticalIssues.length, 0, 'Good sample should have no critical issues');
    });
  });

  describe('Reporter tests with real parsed data', () => {
    it('should generate markdown report with parsed data', async () => {
      const goodData = SeedGenerator.generate('good');
      
      const gcLogPath = path.join(TEST_DATA_DIR, 'trace-gc.log');
      const heapPath = path.join(TEST_DATA_DIR, 'heap-summary.json');
      const retainerPath = path.join(TEST_DATA_DIR, 'retainer-paths.json');
      const configPath = path.join(TEST_DATA_DIR, 'config.json');
      
      fs.writeFileSync(gcLogPath, goodData.gcLog);
      fs.writeFileSync(heapPath, JSON.stringify(goodData.heapSummary, null, 2));
      fs.writeFileSync(retainerPath, JSON.stringify(goodData.retainerPaths, null, 2));
      fs.writeFileSync(configPath, JSON.stringify(goodData.config, null, 2));
      
      const analysisData = {
        meta: {
          analysisTime: new Date().toISOString(),
          toolVersion: '1.0.0'
        },
        gcLog: new GCParser(gcLogPath).parse(),
        heapSummary: new HeapParser(heapPath).parse(),
        retainerPaths: new RetainerParser(retainerPath).parse(),
        config: new ConfigParser(configPath).parse(),
        issues: [],
        simulations: null,
        recommendations: []
      };
      
      const detector = new Detector(analysisData);
      analysisData.issues = detector.detectAll();
      
      const simulator = new Simulator(analysisData);
      analysisData.simulations = simulator.runAllSimulations();
      analysisData.recommendations = simulator.getRecommendations();
      
      const outputDir = path.join(TEST_DATA_DIR, 'reports');
      const reporter = new Reporter(analysisData, outputDir);
      
      const markdownPaths = await reporter.export('markdown');
      assert.ok(Array.isArray(markdownPaths));
      assert.ok(markdownPaths.length > 0);
      
      const reportPath = markdownPaths[0];
      assert.ok(fs.existsSync(reportPath));
      
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(content.includes('# Node.js 内存分析报告'));
      assert.ok(content.includes('## 执行摘要'));
      
      console.log(`  Markdown report generated: ${reportPath}`);
      console.log(`  Report size: ${content.length} chars`);
    });

    it('should generate JSON report', async () => {
      const goodData = SeedGenerator.generate('good');
      
      const analysisData = {
        meta: {
          analysisTime: new Date().toISOString(),
          toolVersion: '1.0.0'
        },
        heapSummary: goodData.heapSummary,
        config: goodData.config,
        issues: [
          {
            id: 'issue-1',
            type: 'test_issue',
            severity: 'warning',
            category: 'test',
            title: 'Test Issue',
            description: 'Test warning issue'
          }
        ],
        simulations: null,
        recommendations: [
          {
            id: 'rec-1',
            priority: 'high',
            title: 'Test recommendation',
            description: 'Test description'
          }
        ]
      };
      
      const outputDir = path.join(TEST_DATA_DIR, 'reports');
      const reporter = new Reporter(analysisData, outputDir);
      
      const jsonPaths = await reporter.export('json');
      assert.ok(Array.isArray(jsonPaths));
      assert.ok(jsonPaths.length > 0);
      
      const reportPath = jsonPaths[0];
      assert.ok(fs.existsSync(reportPath));
      
      const content = fs.readFileSync(reportPath, 'utf-8');
      const json = JSON.parse(content);
      assert.ok(json.meta, 'Should have meta');
      
      console.log(`  JSON report generated: ${reportPath}`);
    });

    it('should generate CSV reports', async () => {
      const analysisData = {
        meta: {
          analysisTime: new Date().toISOString(),
          toolVersion: '1.0.0'
        },
        issues: [
          {
            id: 'issue-1',
            type: 'test_issue',
            severity: 'warning',
            category: 'test',
            title: 'Test Issue 1',
            description: 'Test warning issue'
          },
          {
            id: 'issue-2',
            type: 'test_issue_2',
            severity: 'critical',
            category: 'test',
            title: 'Test Issue 2',
            description: 'Test critical issue'
          }
        ],
        recommendations: [
          {
            id: 'rec-1',
            priority: 'high',
            title: 'Rec 1',
            description: 'Recommendation 1'
          }
        ]
      };
      
      const outputDir = path.join(TEST_DATA_DIR, 'reports');
      const reporter = new Reporter(analysisData, outputDir);
      
      const csvPaths = await reporter.export('csv');
      assert.ok(Array.isArray(csvPaths));
      
      csvPaths.forEach(p => {
        assert.ok(fs.existsSync(p));
        console.log(`  CSV file: ${p}`);
      });
    });
  });

  describe('Comparison: Good vs Bad samples', () => {
    it('should detect more issues in bad sample than good', () => {
      const goodData = SeedGenerator.generate('good');
      const badData = SeedGenerator.generate('bad');
      
      const goodAnalysis = {
        meta: { analysisTime: new Date().toISOString(), toolVersion: '1.0.0' },
        heapSummary: goodData.heapSummary,
        retainerPaths: goodData.retainerPaths,
        config: goodData.config,
        issues: [],
        simulations: null,
        recommendations: []
      };
      
      const badAnalysis = {
        meta: { analysisTime: new Date().toISOString(), toolVersion: '1.0.0' },
        heapSummary: badData.heapSummary,
        retainerPaths: badData.retainerPaths,
        config: badData.config,
        issues: [],
        simulations: null,
        recommendations: []
      };
      
      const goodDetector = new Detector(goodAnalysis);
      const badDetector = new Detector(badAnalysis);
      
      const goodIssues = goodDetector.detectAll();
      const badIssues = badDetector.detectAll();
      
      const goodCritical = goodIssues.filter(i => i.severity === 'critical');
      const badCritical = badIssues.filter(i => i.severity === 'critical');
      
      console.log(`  Sample comparison:`);
      console.log(`    Good sample issues: ${goodIssues.length} (critical: ${goodCritical.length})`);
      console.log(`    Bad sample issues: ${badIssues.length} (critical: ${badCritical.length})`);
      
      assert.ok(badCritical.length >= goodCritical.length, 'Bad sample should have more or equal critical issues');
      assert.ok(badCritical.length > 0, 'Bad sample should have at least some critical issues');
    });
  });

  describe('End-to-end CLI flow test', () => {
    it('should parse all file types correctly', () => {
      const badData = SeedGenerator.generate('bad');
      
      const gcLogPath = path.join(TEST_DATA_DIR, 'trace-gc.log');
      const heapPath = path.join(TEST_DATA_DIR, 'heap-summary.json');
      const retainerPath = path.join(TEST_DATA_DIR, 'retainer-paths.json');
      const configPath = path.join(TEST_DATA_DIR, 'config.json');
      
      fs.writeFileSync(gcLogPath, badData.gcLog);
      fs.writeFileSync(heapPath, JSON.stringify(badData.heapSummary, null, 2));
      fs.writeFileSync(retainerPath, JSON.stringify(badData.retainerPaths, null, 2));
      fs.writeFileSync(configPath, JSON.stringify(badData.config, null, 2));
      
      const gcData = new GCParser(gcLogPath).parse();
      const heapData = new HeapParser(heapPath).parse();
      const retainerData = new RetainerParser(retainerPath).parse();
      const configData = new ConfigParser(configPath).parse();
      
      assert.ok(gcData.events.length > 0, 'GC log should have events');
      assert.ok(heapData.summary, 'Heap summary should have summary');
      assert.ok(badData.retainerPaths.suspiciousPaths.length > 0, 'Seed data should have suspicious paths');
      assert.ok(configData.summary.overview.criticalIssues > 0, 'Config should have critical issues');
      
      console.log(`  End-to-end parsing:`);
      console.log(`    GC events: ${gcData.events.length}`);
      console.log(`    Seed suspicious paths: ${badData.retainerPaths.suspiciousPaths.length}`);
      console.log(`    Config critical issues: ${configData.summary.overview.criticalIssues}`);
    });
  });
});
