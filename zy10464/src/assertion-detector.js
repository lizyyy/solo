class AssertionDetector {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.quiet = options.quiet || false;
  }

  analyze(requests) {
    const results = {
      total: requests.length,
      withAssertions: 0,
      withoutAssertions: 0,
      coverageRate: 0,
      details: [],
      assertionCount: 0,
      assertionTypes: {},
      issues: []
    };

    for (const request of requests) {
      const requestResult = this.analyzeRequest(request);
      results.details.push(requestResult);

      if (requestResult.hasAssertions) {
        results.withAssertions++;
        results.assertionCount += requestResult.assertionCount;
        for (const type of requestResult.assertionTypes) {
          results.assertionTypes[type] = (results.assertionTypes[type] || 0) + 1;
        }
      } else {
        results.withoutAssertions++;
      }

      if (requestResult.issues.length > 0) {
        results.issues.push(...requestResult.issues);
      }
    }

    results.coverageRate = results.total > 0 
      ? Number(((results.withAssertions / results.total) * 100).toFixed(2))
      : 0;

    return results;
  }

  analyzeRequest(request) {
    const testScripts = request.eventScripts?.test || [];
    const allAssertions = [];

    for (const script of testScripts) {
      const assertions = this.extractAssertions(script.content);
      allAssertions.push(...assertions);
    }

    const hasAssertions = allAssertions.length > 0;
    const assertionTypes = [...new Set(allAssertions.map(a => a.type))];
    const issues = this.findIssues(request, allAssertions);

    return {
      requestId: request.id,
      requestName: request.name,
      requestPath: request.path,
      requestMethod: request.method,
      requestUrl: request.url,
      hasAssertions,
      assertionCount: allAssertions.length,
      assertions: allAssertions,
      assertionTypes,
      hasTestScript: request.hasTests,
      issues,
      sourceFile: request.sourceFile,
      sourceLocation: request.sourceLocation
    };
  }

  extractAssertions(scriptContent) {
    const assertions = [];
    
    const pmTestPattern = /pm\.test\s*\(\s*["']([^"']+)["']\s*,\s*\(\s*\)\s*=>\s*\{([^}]+)\}/gs;
    const pmExpectPattern = /pm\.expect\s*\(\s*([^)]+)\s*\)\.(\w+)/g;
    const testsPattern = /tests\s*\[\s*["']([^"']+)["']\s*\]\s*=/g;

    let match;

    while ((match = pmTestPattern.exec(scriptContent)) !== null) {
      const testName = match[1];
      const testBody = match[2];
      const lineNumber = this.getLineNumber(scriptContent, match.index);
      
      const types = this.detectAssertionTypes(testBody);
      
      assertions.push({
        type: 'pm.test',
        name: testName,
        types,
        line: lineNumber,
        snippet: testBody.substring(0, 100).trim()
      });
    }

    while ((match = pmExpectPattern.exec(scriptContent)) !== null) {
      const target = match[1];
      const method = match[2];
      const lineNumber = this.getLineNumber(scriptContent, match.index);

      assertions.push({
        type: `pm.expect.${method}`,
        name: `${target}.${method}`,
        types: [method],
        line: lineNumber,
        snippet: `pm.expect(${target}).${method}`
      });
    }

    while ((match = testsPattern.exec(scriptContent)) !== null) {
      const testName = match[1];
      const lineNumber = this.getLineNumber(scriptContent, match.index);

      assertions.push({
        type: 'tests[]',
        name: testName,
        types: ['legacy-test'],
        line: lineNumber,
        snippet: `tests["${testName}"]`
      });
    }

    const statusCodePattern = /pm\.response\.code\b/g;
    while ((match = statusCodePattern.exec(scriptContent)) !== null) {
      const lineNumber = this.getLineNumber(scriptContent, match.index);
      if (!assertions.some(a => a.line === lineNumber && a.types.includes('statusCode'))) {
        assertions.push({
          type: 'status-code-check',
          name: 'Response Status Code',
          types: ['statusCode'],
          line: lineNumber,
          snippet: 'pm.response.code'
        });
      }
    }

    return assertions;
  }

  detectAssertionTypes(testBody) {
    const types = [];
    
    if (/\.to\.have\.status|pm\.response\.code|responseCode\.code/.test(testBody)) {
      types.push('statusCode');
    }
    if (/\.json|JSON\.parse/.test(testBody)) {
      types.push('jsonBody');
    }
    if (/\.to\.include|pm\.response\.text/.test(testBody)) {
      types.push('responseBody');
    }
    if (/headers/.test(testBody)) {
      types.push('headers');
    }
    if (/responseTime/.test(testBody)) {
      types.push('responseTime');
    }
    if (/setEnvironmentVariable|pm\.environment\.set/.test(testBody)) {
      types.push('variableExtraction');
    }

    return types;
  }

  findIssues(request, assertions) {
    const issues = [];

    if (request.hasTests && assertions.length === 0) {
      issues.push({
        type: 'EMPTY_TEST_SCRIPT',
        severity: 'warning',
        message: '存在 Test 脚本但未检测到有效断言',
        suggestion: '添加 pm.test() 或 pm.expect() 断言'
      });
    }

    const emptyTestScripts = request.eventScripts?.test?.filter(s => !s.content.trim());
    if (emptyTestScripts && emptyTestScripts.length > 0) {
      issues.push({
        type: 'EMPTY_SCRIPT_CONTENT',
        severity: 'warning',
        message: 'Test 脚本内容为空',
        suggestion: '删除空脚本或添加断言逻辑'
      });
    }

    return issues;
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }
}

module.exports = AssertionDetector;
