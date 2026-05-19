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
        queryParams: { ...req.query },
        body: this.sanitizeBody(req.body),
        params: { ...req.params },
        timestamp: new Date().toISOString()
      };

      const originalSend = res.send;
      const originalJson = res.json;
      const originalStatus = res.status;

      let responseBody = null;
      let statusCode = 200;

      res.status = function(code) {
        statusCode = code;
        return originalStatus.call(this, code);
      };

      res.send = function(body) {
        responseBody = body;
        return originalSend.call(this, body);
      };

      res.json = function(body) {
        responseBody = body;
        return originalJson.call(this, body);
      };

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        let responseData = responseBody;
        if (typeof responseData === 'string') {
          try {
            responseData = JSON.parse(responseData);
          } catch (e) {
            responseData = { raw: responseData.substring(0, 500) };
          }
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
            success: responseData?.success === true,
            error: responseData?.error || null,
            dataSummary: this.summarizeData(responseData?.data),
            duration
          },
          timestamp: new Date().toISOString(),
          isError: statusCode >= 400 || responseData?.success === false
        };

        store.addFullRequestLog(auditLog);
      });

      req.requestId = requestId;
      next();
    };
  }

  sanitizeBody(body) {
    if (!body) return null;
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'authorization'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    return JSON.parse(JSON.stringify(sanitized));
  }

  summarizeData(data) {
    if (!data) return null;
    if (Array.isArray(data)) {
      return { type: 'array', length: data.length, sample: data.slice(0, 3) };
    }
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      return { type: 'object', keys: keys.slice(0, 10), totalKeys: keys.length };
    }
    return { type: typeof data, value: String(data).substring(0, 100) };
  }
}

module.exports = new AuditMiddleware();