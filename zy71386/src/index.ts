export { ContractParser } from './contract-parser';
export { ContractComparator } from './contract-comparator';
export { VersionTracker } from './version-tracker';
export { SampleGenerator } from './sample-generator';
export { ReportExporter } from './report-exporter';
export * from './types';

import { ContractParser } from './contract-parser';
import { ContractComparator } from './contract-comparator';
import { ReportExporter } from './report-exporter';
import { VersionTracker } from './version-tracker';
import { SampleGenerator } from './sample-generator';
import { ApiContract, ContractDiffResult, ReportOptions, CompatibilityCheckOptions } from './types';

export class ContractSentinel {
  private parser: ContractParser;
  private comparator: ContractComparator;
  private reporter: ReportExporter;
  private versionTracker: VersionTracker;
  private sampleGenerator: SampleGenerator;

  constructor(sourceName: string = 'default', options?: Partial<CompatibilityCheckOptions>) {
    this.parser = new ContractParser(sourceName);
    this.comparator = new ContractComparator(options);
    this.reporter = new ReportExporter();
    this.versionTracker = new VersionTracker();
    this.sampleGenerator = new SampleGenerator();
  }

  parseOpenAPI(filePath: string): ApiContract {
    return this.parser.parseOpenAPI(filePath);
  }

  parseFromResponses(
    responses: Array<{ path: string; method: string; statusCode: number; body: unknown }>,
    source: 'mock' | 'real',
    version?: string
  ): ApiContract {
    if (source === 'mock') {
      return this.parser.parseFromMockResponse(responses, version);
    }
    return this.parser.parseFromRealResponse(responses, version);
  }

  compare(contractA: ApiContract, contractB: ApiContract): ContractDiffResult {
    return this.comparator.compare(contractA, contractB);
  }

  exportReport(diff: ContractDiffResult, options: ReportOptions): string {
    return this.reporter.export(diff, options);
  }

  trackVersion(contract: ApiContract, changes?: string[]): import('./types').VersionRecord {
    const detectedChanges = changes || [];
    
    if (this.versionTracker['headVersion']) {
      const headDiff = this.versionTracker.compareWithHead(contract);
      if (headDiff) {
        detectedChanges.push(...this.versionTracker.detectChanges(headDiff));
      }
    }

    return this.versionTracker.track(contract, detectedChanges);
  }

  generateExamples(contract: ApiContract) {
    return this.sampleGenerator.generateContractExamples(contract);
  }

  validateInput(input: {
    openapiPath?: string;
    mockResponses?: Array<{ path: string; method: string; statusCode: number; body: unknown }>;
    realResponses?: Array<{ path: string; method: string; statusCode: number; body: unknown }>;
  }): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!input.openapiPath) {
      missing.push('OpenAPI文档路径');
    }
    if (!input.mockResponses || input.mockResponses.length === 0) {
      missing.push('Mock响应数据');
    }
    if (!input.realResponses || input.realResponses.length === 0) {
      missing.push('真实响应数据');
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}
