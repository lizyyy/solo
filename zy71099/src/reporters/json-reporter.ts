import { DiffResult } from '../types';
import { BaseReporter } from './base-reporter';

export class JsonReporter extends BaseReporter {
  generate(): string {
    const report = {
      metadata: {
        generatedAt: this.result.generatedAt,
        version: '1.0.0',
        expectedFile: this.expectedFile,
        actualFile: this.actualFile
      },
      summary: this.result.summary,
      config: this.result.config,
      differences: this.result.differences.map(diff => ({
        interactionId: diff.interactionId,
        type: diff.type,
        severity: diff.severity,
        message: diff.message,
        details: diff.details,
        expectedSource: diff.expectedSource,
        actualSource: diff.actualSource
      })),
      exitCode: {
        code: this.result.exitCode,
        explanation: this.getExitCodeExplanation()
      }
    };

    return JSON.stringify(report, null, 2);
  }

  getFileName(): string {
    return 'cassette-diff.json';
  }
}
