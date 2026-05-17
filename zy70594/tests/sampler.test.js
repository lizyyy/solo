const assert = require('assert');
const { describe, it, before, beforeEach } = require('node:test');
const path = require('path');
const { LogParser, SamplingEngine, CDNSampler } = require('../src/index');

describe('LogParser', () => {
  it('should parse nginx log format correctly', () => {
    const parser = new LogParser({ format: 'nginx' });
    const line = '192.168.1.1 - - [10/May/2024:10:00:01 +0800] "GET /index.html HTTP/1.1" 200 1234 "https://example.com" "Mozilla/5.0" "CN"';
    const result = parser.parseLine(line, 1);
    
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.data.ip, '192.168.1.1');
    assert.strictEqual(result.data.status, 200);
    assert.strictEqual(result.data.method, 'GET');
    assert.strictEqual(result.data.url, '/index.html');
    assert.strictEqual(result.data.resourceType, 'html');
    assert.strictEqual(result.data.region, 'CN');
  });

  it('should detect invalid log lines', () => {
    const parser = new LogParser({ format: 'nginx' });
    const result = parser.parseLine('这是无效的日志行', 1);
    
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.error, 'pattern_mismatch');
    assert.strictEqual(result.lineNumber, 1);
  });

  it('should detect resource types from URL', () => {
    const parser = new LogParser({ format: 'nginx' });
    
    const testCases = [
      ['/style.css', 'css'],
      ['/app.js', 'javascript'],
      ['/image.jpg', 'image'],
      ['/video.mp4', 'video'],
      ['/doc.pdf', 'document'],
      ['/font.woff2', 'font'],
      ['/unknown.xyz', 'other']
    ];

    for (const [url, expectedType] of testCases) {
      assert.strictEqual(parser.getResourceType(url), expectedType);
    }
  });
});

describe('SamplingEngine', () => {
  let sampler;

  beforeEach(() => {
    sampler = new SamplingEngine({
      sampleSize: 100,
      minPerStratum: 2,
      maxPerStratum: 50
    });
  });

  it('should process valid records and collect samples', () => {
    const record = {
      valid: true,
      data: { status: 200, region: 'US', resourceType: 'html', url: '/test.html', ip: '1.2.3.4' },
      lineNumber: 1,
      raw: 'test log line'
    };

    const result = sampler.processRecord(record);
    
    assert.strictEqual(result.action, 'selected');
    assert.strictEqual(sampler.getSummary().totalSampled, 1);
  });

  it('should detect duplicate records', () => {
    const record = {
      valid: true,
      data: { status: 200, region: 'US', resourceType: 'html', url: '/test.html', ip: '1.2.3.4' },
      lineNumber: 1,
      raw: 'test log line'
    };

    sampler.processRecord(record);
    const result = sampler.processRecord(record);
    
    assert.strictEqual(result.action, 'duplicate');
  });

  it('should filter by status codes', () => {
    sampler.filterByStatusCodes([404, 500]);
    
    const record200 = {
      valid: true,
      data: { status: 200, region: 'US', resourceType: 'html', url: '/a.html', ip: '1.1.1.1' },
      lineNumber: 1
    };
    const record404 = {
      valid: true,
      data: { status: 404, region: 'US', resourceType: 'html', url: '/b.html', ip: '2.2.2.2' },
      lineNumber: 2
    };

    assert.strictEqual(sampler.shouldFilter(record200), true);
    assert.strictEqual(sampler.shouldFilter(record404), false);
  });

  it('should generate stratum key correctly', () => {
    const record = {
      valid: true,
      data: { status: 200, region: 'US', resourceType: 'html' }
    };

    const key = sampler.getStratumKey(record);
    assert.strictEqual(key, '200|US|html');
  });
});

describe('CDNSampler Integration', () => {
  it('should process sample log file', async () => {
    const sampler = new CDNSampler({
      input: path.join(__dirname, '../data/sample-nginx.log'),
      format: 'nginx',
      sampleSize: 50,
      progress: false,
      terminal: false
    });

    const result = await sampler.processFile(sampler.options.input);
    
    assert.ok(result.summary.totalProcessed > 0);
    assert.ok(result.summary.totalValid > 0);
    assert.ok(result.samples.length > 0);
    assert.ok(result.invalidRecords.length > 0);
  });
});
