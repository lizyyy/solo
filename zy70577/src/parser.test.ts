import { LogParser } from './parser';
import { CLIOptions } from './types';
import * as fs from 'fs';
import * as path from 'path';

describe('LogParser', () => {
  let parser: LogParser;
  let testLogPath: string;

  beforeEach(() => {
    const options: CLIOptions = {
      input: 'test.log',
      verbose: false,
      quiet: false,
      logFormat: 'github-actions',
    };
    parser = new LogParser(options);
  });

  beforeAll(() => {
    testLogPath = path.join(__dirname, '../examples/sample-build.log');
  });

  test('should parse cache hit lines', () => {
    const line = 'Cache restored from key: node-modules-v1';
    const result = (parser as any).parseLine(line, 1, 'test');
    
    expect(result.hitStatus).toBe('hit');
    expect(result.cacheKey).toBe('node-modules-v1');
  });

  test('should parse cache miss lines', () => {
    const line = 'Cache not found for input keys: build-cache-v2';
    const result = (parser as any).parseLine(line, 1, 'test');
    
    expect(result.hitStatus).toBe('miss');
    expect(result.cacheKey).toBe('build-cache-v2');
  });

  test('should parse duration in milliseconds', () => {
    const line = 'npm install completed in 4000ms';
    const result = (parser as any).parseLine(line, 1, 'test');
    
    expect(result.durationMs).toBe(4000);
  });

  test('should parse stage names', () => {
    const line = '##[group]Install Dependencies';
    const result = (parser as any).parseLine(line, 1, 'unknown');
    
    expect(result.stage).toBe('Install Dependencies');
  });

  test('should detect github-actions format', () => {
    const content = '##[group]Test\nCache restored from key: test\n##[endgroup]';
    const format = parser.detectFormatFromContent(content);
    
    expect(format).toBe('github-actions');
  });

  test('should parse real log file', async () => {
    const options: CLIOptions = {
      input: testLogPath,
      verbose: false,
      quiet: false,
    };
    const realParser = new LogParser(options);
    const result = await realParser.parse();
    
    expect(result.totalLines).toBeGreaterThan(0);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.badLines.length).toBeGreaterThan(0);
  });
});
