class ExampleDetector {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.quiet = options.quiet || false;
  }

  analyze(requests) {
    const results = {
      total: requests.length,
      withExamples: 0,
      withoutExamples: 0,
      coverageRate: 0,
      totalExamples: 0,
      statusCodeDistribution: {},
      contentTypeDistribution: {},
      details: [],
      issues: []
    };

    for (const request of requests) {
      const requestResult = this.analyzeRequest(request);
      results.details.push(requestResult);

      if (requestResult.hasExamples) {
        results.withExamples++;
        results.totalExamples += requestResult.exampleCount;
        
        for (const [statusCode, count] of Object.entries(requestResult.statusCodes)) {
          results.statusCodeDistribution[statusCode] = (results.statusCodeDistribution[statusCode] || 0) + count;
        }
        
        for (const [type, count] of Object.entries(requestResult.contentTypes)) {
          results.contentTypeDistribution[type] = (results.contentTypeDistribution[type] || 0) + count;
        }
      } else {
        results.withoutExamples++;
      }

      if (requestResult.issues.length > 0) {
        results.issues.push(...requestResult.issues);
      }
    }

    results.coverageRate = results.total > 0 
      ? Number(((results.withExamples / results.total) * 100).toFixed(2))
      : 0;

    return results;
  }

  analyzeRequest(request) {
    const responses = request.responses || [];
    const examples = [];
    const statusCodes = {};
    const contentTypes = {};

    for (const response of responses) {
      const example = this.processExample(request, response);
      if (example) {
        examples.push(example);
        
        const statusCode = example.statusCode || 'unknown';
        statusCodes[statusCode] = (statusCodes[statusCode] || 0) + 1;
        
        const contentType = example.contentType || 'unknown';
        contentTypes[contentType] = (contentTypes[contentType] || 0) + 1;
      }
    }

    const hasExamples = examples.length > 0;
    const issues = this.findIssues(request, examples);

    return {
      requestId: request.id,
      requestName: request.name,
      requestPath: request.path,
      requestMethod: request.method,
      requestUrl: request.url,
      hasExamples,
      exampleCount: examples.length,
      examples,
      statusCodes,
      contentTypes,
      issues,
      sourceFile: request.sourceFile,
      sourceLocation: request.sourceLocation
    };
  }

  processExample(request, response) {
    if (!response) return null;

    const example = {
      id: response.id || this.generateId(),
      name: response.name || 'Unnamed Example',
      originalRequest: response.originalRequest,
      statusCode: response.code,
      statusText: response.status,
      contentType: this.extractContentType(response.header),
      headers: response.header || [],
      body: response.body || '',
      responseTime: response.responseTime || 0,
      size: this.calculateSize(response),
      isEmpty: this.isEmptyResponse(response),
      hasJsonBody: false,
      hasValidJson: true
    };

    if (example.body && example.body.trim()) {
      if (example.contentType?.includes('json')) {
        example.hasJsonBody = true;
        try {
          JSON.parse(example.body);
        } catch {
          example.hasValidJson = false;
        }
      }
    }

    return example;
  }

  extractContentType(headers) {
    if (!headers) return null;
    
    const headerArray = Array.isArray(headers) ? headers : [headers];
    const contentTypeHeader = headerArray.find(h => 
      h && h.key && h.key.toLowerCase() === 'content-type'
    );
    
    return contentTypeHeader ? contentTypeHeader.value : null;
  }

  calculateSize(response) {
    let size = 0;
    
    if (response.body) {
      size += Buffer.byteLength(response.body, 'utf-8');
    }
    
    if (response.header) {
      const headers = Array.isArray(response.header) ? response.header : [response.header];
      for (const header of headers) {
        if (header && header.key && header.value) {
          size += Buffer.byteLength(header.key + header.value, 'utf-8');
        }
      }
    }
    
    return size;
  }

  isEmptyResponse(response) {
    return !response.body || !response.body.trim();
  }

  findIssues(request, examples) {
    const issues = [];

    for (const example of examples) {
      if (example.isEmpty) {
        issues.push({
          type: 'EMPTY_EXAMPLE_BODY',
          severity: 'info',
          exampleName: example.name,
          message: '示例响应体为空',
          suggestion: '添加有意义的响应体示例'
        });
      }

      if (example.hasJsonBody && !example.hasValidJson) {
        issues.push({
          type: 'INVALID_JSON_EXAMPLE',
          severity: 'warning',
          exampleName: example.name,
          message: 'JSON 格式无效',
          suggestion: '修复示例响应中的 JSON 语法错误'
        });
      }

      if (!example.statusCode) {
        issues.push({
          type: 'MISSING_STATUS_CODE',
          severity: 'warning',
          exampleName: example.name,
          message: '缺少状态码',
          suggestion: '为示例响应添加状态码'
        });
      }
    }

    if (examples.length === 1 && examples[0].statusCode === 200) {
      issues.push({
        type: 'ONLY_SUCCESS_EXAMPLE',
        severity: 'info',
        message: '只有成功响应示例 (200)',
        suggestion: '考虑添加错误场景的示例 (400, 404, 500 等)'
      });
    }

    return issues;
  }

  generateId() {
    return 'ex_' + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = ExampleDetector;
