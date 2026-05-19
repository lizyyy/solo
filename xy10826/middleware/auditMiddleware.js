const store = require('../store/dataStore');

class AuditMiddleware {
  constructor() {
    this.requestIdCounter = 0;
  }

  generateRequestId() {
    this.requestIdCounter++;
    return `REQ_${Date.now()}_${this.requestIdCounter}`;
  }

  auditRequest(options = {}) {
    return (req, res, next) => {
      const requestId = this.generateRequestId();
      const startTime = Date.now();
      
      const requestData = {
        requestId,
        method: req.method,
        path: req.path,
        url: req.originalUrl,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        operator: req.body?.operator || req.query?.operator || 'system',
        queryParams: this.cloneData(req.query),
        body: this.sanitizeBody(req.body),
        params: this.cloneData(req.params),
        headers: this.sanitizeHeaders(req.headers),
        timestamp: new Date().toISOString()
      };

      const originalWrite = res.write;
      const originalEnd = res.end;
      const originalJson = res.json;
      const originalSend = res.send;
      const originalStatus = res.status;

      const responseChunks = [];
      let responseBody = null;
      let statusCode = 200;
      let contentType = res.getHeader('Content-Type') || 'unknown';

      res.status = function(code) {
        statusCode = code;
        return originalStatus.call(this, code);
      };

      res.write = function(chunk) {
        if (Buffer.isBuffer(chunk)) {
          responseChunks.push(chunk);
        } else if (typeof chunk === 'string') {
          responseChunks.push(Buffer.from(chunk));
        }
        return originalWrite.apply(this, arguments);
      };

      res.end = function(chunk) {
        if (chunk) {
          if (Buffer.isBuffer(chunk)) {
            responseChunks.push(chunk);
          } else if (typeof chunk === 'string') {
            responseChunks.push(Buffer.from(chunk));
          }
        }
        return originalEnd.apply(this, arguments);
      };

      res.json = function(body) {
        responseBody = body;
        contentType = 'application/json';
        return originalJson.call(this, body);
      };

      res.send = function(body) {
        if (typeof body === 'string') {
          if (body.startsWith('{') || body.startsWith('[')) {
            try {
              responseBody = JSON.parse(body);
              contentType = 'application/json';
            } catch (e) {
              responseBody = body;
            }
          } else {
            responseBody = body;
          }
        } else {
          responseBody = body;
        }
        return originalSend.call(this, body);
      };

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        let fullResponse = responseBody;
        let responseType = 'json';
        let responseSize = 0;

        if (responseChunks.length > 0) {
          const rawResponse = Buffer.concat(responseChunks).toString('utf8');
          responseSize = Buffer.byteLength(rawResponse, 'utf8');
          
          const currentContentType = res.getHeader('Content-Type') || contentType;
          
          if (currentContentType && currentContentType.includes('application/json')) {
            try {
              fullResponse = JSON.parse(rawResponse);
              responseType = 'json';
            } catch (e) {
              fullResponse = rawResponse;
              responseType = 'raw';
            }
          } else if (currentContentType && currentContentType.includes('text/csv')) {
            fullResponse = rawResponse;
            responseType = 'csv';
          } else if (currentContentType && (currentContentType.includes('text/') || currentContentType.includes('application'))) {
            fullResponse = rawResponse;
            responseType = 'text';
          } else {
            fullResponse = rawResponse.substring(0, 10000);
            responseType = 'other';
          }
        } else if (responseBody !== null) {
          responseSize = Buffer.byteLength(JSON.stringify(responseBody), 'utf8');
        }

        const auditLog = {
          requestId,
          action: options.action || `${req.method}_${req.path.split('/').filter(Boolean).join('_')}`,
          entityId: req.params?.id || null,
          entityType: options.entityType || 'api_request',
          operator: requestData.operator,
          request: requestData,
          response: {
            statusCode,
            success: statusCode >= 200 && statusCode < 400,
            contentType: contentType,
            responseType,
            responseSize,
            duration,
            fullData: fullResponse
          },
          timestamp: new Date().toISOString(),
          isError: statusCode >= 400
        };

        if (auditLog.response.responseType === 'csv') {
          const csvPreview = auditLog.response.fullData;
          const csvLines = csvPreview.split('\n').slice(0, 10);
          auditLog.response.csvPreview = csvLines;
          auditLog.response.csvTotalLines = csvPreview.split('\n').length;
        }

        store.addFullRequestLog(auditLog);
      });

      req.requestId = requestId;
      next();
    };
  }

  sanitizeBody(body) {
    if (!body) return null;
    const cloned = this.cloneData(body);
    const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'Authorization'];
    sensitiveFields.forEach(field => {
      if (cloned[field]) {
        cloned[field] = '[REDACTED]';
      }
      if (typeof cloned[field] === 'object' && cloned[field] !== null) {
        this.sanitizeNested(cloned[field], sensitiveFields);
      }
    });
    return cloned;
  }

  sanitizeNested(obj, sensitiveFields) {
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          this.sanitizeNested(item, sensitiveFields);
        }
      });
    } else {
      Object.keys(obj).forEach(key => {
        if (sensitiveFields.some(sf => key.toLowerCase().includes(sf.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          this.sanitizeNested(obj[key], sensitiveFields);
        }
      });
    }
  }

  sanitizeHeaders(headers) {
    if (!headers) return null;
    const cloned = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'token', 'secret'];
    sensitiveHeaders.forEach(field => {
      if (cloned[field]) {
        cloned[field] = '[REDACTED]';
      }
    });
    return cloned;
  }

  cloneData(data) {
    if (!data) return null;
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (e) {
      return String(data);
    }
  }
}

module.exports = new AuditMiddleware();