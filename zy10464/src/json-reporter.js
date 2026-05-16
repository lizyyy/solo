const fs = require('fs');
const path = require('path');

class JsonReporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './audit-output';
    this.reportName = options.reportName || 'postman-audit';
    this.verbose = options.verbose || false;
    this.quiet = options.quiet || false;
  }

  async generate(auditResult) {
    this.ensureOutputDir();

    const outputPath = path.join(this.outputDir, `${this.reportName}.json`);
    
    const reportData = this.buildReport(auditResult);
    
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2), 'utf-8');
    
    if (!this.quiet) {
      console.log(`📄 JSON报告已生成: ${outputPath}`);
    }

    return outputPath;
  }

  buildReport(auditResult) {
    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      metadata: auditResult.metadata,
      summary: auditResult.summary,
      assertions: {
        coverage: {
          rate: auditResult.assertions.coverageRate,
          withAssertions: auditResult.assertions.withAssertions,
          withoutAssertions: auditResult.assertions.withoutAssertions,
          total: auditResult.assertions.total
        },
        statistics: {
          totalAssertions: auditResult.assertions.assertionCount,
          types: auditResult.assertions.assertionTypes
        },
        requests: this.summarizeRequests(auditResult.assertions.details, 'assertions'),
        issues: auditResult.assertions.issues
      },
      examples: {
        coverage: {
          rate: auditResult.examples.coverageRate,
          withExamples: auditResult.examples.withExamples,
          withoutExamples: auditResult.examples.withoutExamples,
          total: auditResult.examples.total
        },
        statistics: {
          totalExamples: auditResult.examples.totalExamples,
          statusCodeDistribution: auditResult.examples.statusCodeDistribution,
          contentTypeDistribution: auditResult.examples.contentTypeDistribution
        },
        requests: this.summarizeRequests(auditResult.examples.details, 'examples'),
        issues: auditResult.examples.issues
      },
      variables: auditResult.variables ? {
        environment: auditResult.variables.environmentFile,
        requestsWithVariables: auditResult.variables.requestsWithVariables,
        requestsWithoutVariables: auditResult.variables.requestsWithoutVariables,
        variableReferences: auditResult.variables.variableReferences,
        undefinedVariables: auditResult.variables.uniqueUndefinedVariables,
        issues: auditResult.variables.issues
      } : null
    };
  }

  summarizeRequests(details, type) {
    const withCoverage = [];
    const withoutCoverage = [];

    for (const detail of details) {
      const summary = {
        id: detail.requestId,
        name: detail.requestName,
        path: detail.requestPath,
        method: detail.requestMethod,
        url: detail.requestUrl,
        sourceFile: detail.sourceFile,
        sourceLocation: detail.sourceLocation
      };

      if (type === 'assertions') {
        summary.assertionCount = detail.assertionCount;
        summary.assertionTypes = detail.assertionTypes;
        if (detail.hasAssertions) {
          withCoverage.push(summary);
        } else {
          withoutCoverage.push(summary);
        }
      } else {
        summary.exampleCount = detail.exampleCount;
        summary.statusCodes = detail.statusCodes;
        if (detail.hasExamples) {
          withCoverage.push(summary);
        } else {
          withoutCoverage.push(summary);
        }
      }
    }

    return { withCoverage, withoutCoverage };
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
}

module.exports = JsonReporter;
