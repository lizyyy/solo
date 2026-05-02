import yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';

export class OpenAPIParser {
  static async parse(content, isYaml = true) {
    try {
      let parsedContent;
      if (isYaml) {
        parsedContent = yaml.load(content);
      } else {
        parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
      }

      const validated = await SwaggerParser.validate(parsedContent);
      return {
        success: true,
        data: validated
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static extractOperations(spec) {
    const operations = [];
    const paths = spec.paths || {};

    for (const [path, pathItem] of Object.entries(paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
      
      for (const method of methods) {
        if (pathItem[method]) {
          const operation = pathItem[method];
          const operationId = operation.operationId || this.generateOperationId(path, method);
          
          operations.push({
            path,
            method: method.toUpperCase(),
            operationId,
            summary: operation.summary,
            tags: operation.tags || [],
            parameters: this.extractParameters(pathItem.parameters, operation.parameters),
            requestBody: operation.requestBody,
            responses: operation.responses,
            deprecated: operation.deprecated || false,
            pathItem
          });
        }
      }
    }

    return operations;
  }

  static generateOperationId(path, method) {
    const pathSegments = path.split('/').filter(Boolean);
    const camelCase = pathSegments.map((segment, index) => {
      if (segment.startsWith('{') && segment.endsWith('}')) {
        return segment.slice(1, -1);
      }
      return index === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1);
    }).join('');
    return `${method}${camelCase.charAt(0).toUpperCase() + camelCase.slice(1)}`;
  }

  static extractParameters(pathParams, operationParams) {
    const params = [];
    
    if (pathParams) {
      params.push(...pathParams);
    }
    if (operationParams) {
      params.push(...operationParams);
    }

    return params;
  }

  static extractSchemas(spec) {
    return spec.components?.schemas || {};
  }
}

export class JSONLParser {
  static parse(content) {
    try {
      const lines = content.trim().split('\n');
      const records = [];
      const errors = [];

      lines.forEach((line, index) => {
        try {
          if (line.trim()) {
            records.push(JSON.parse(line));
          }
        } catch (e) {
          errors.push({
            line: index + 1,
            error: e.message,
            content: line
          });
        }
      });

      return {
        success: errors.length === 0,
        data: records,
        errors
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static extractRequestResponsePairs(records) {
    const pairs = [];

    records.forEach((record, index) => {
      const request = record.request || record.req;
      const response = record.response || record.res;

      if (request) {
        pairs.push({
          id: index,
          request: this.normalizeRequest(request),
          response: response ? this.normalizeResponse(response) : null,
          mockResponse: record.mockResponse ? this.normalizeResponse(record.mockResponse) : null,
          timestamp: record.timestamp
        });
      }
    });

    return pairs;
  }

  static normalizeRequest(request) {
    return {
      method: request.method?.toUpperCase() || 'GET',
      url: request.url || request.path || '',
      headers: request.headers || {},
      body: request.body || request.data,
      query: request.query || request.params || {}
    };
  }

  static normalizeResponse(response) {
    return {
      status: response.status || response.statusCode || 200,
      statusText: response.statusText,
      headers: response.headers || {},
      body: response.body || response.data
    };
  }
}
