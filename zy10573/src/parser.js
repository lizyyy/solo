const fs = require('fs');
const readline = require('readline');

class TraceParser {
  constructor(options = {}) {
    this.options = {
      sampleLimit: options.sampleLimit || 5,
      ...options
    };
    this.errors = [];
    this.spans = [];
    this.lineNumber = 0;
  }

  async parseFile(filePath) {
    const stats = fs.statSync(filePath);
    
    if (stats.size === 0) {
      this.errors.push({
        line: 0,
        error: 'Empty file',
        raw: ''
      });
      return this.getResult();
    }

    const firstLine = await this.getFirstLine(filePath);
    
    if (firstLine.trim().startsWith('{')) {
      return this.parseNDJSON(filePath);
    }
    
    return this.parseJSON(filePath);
  }

  async getFirstLine(filePath) {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8', start: 0, end: 1024 });
    let data = '';
    for await (const chunk of stream) {
      data += chunk;
      if (data.includes('\n')) break;
    }
    return data.split('\n')[0] || '';
  }

  async parseNDJSON(filePath) {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      this.lineNumber++;
      const trimmed = line.trim();
      
      if (!trimmed) continue;
      
      try {
        const data = JSON.parse(trimmed);
        this.processSpan(data, this.lineNumber);
      } catch (e) {
        this.errors.push({
          line: this.lineNumber,
          error: `JSON parse error: ${e.message}`,
          raw: line
        });
      }
    }

    return this.getResult();
  }

  async parseJSON(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        data.forEach((item, index) => {
          this.lineNumber = index + 1;
          this.processSpan(item, this.lineNumber);
        });
      } else if (data.resourceSpans || data.spans) {
        this.processOTLPFormat(data);
      } else {
        this.processSpan(data, 1);
      }
    } catch (e) {
      this.errors.push({
        line: 0,
        error: `JSON parse error: ${e.message}`,
        raw: e.message
      });
    }

    return this.getResult();
  }

  processOTLPFormat(data) {
    let lineNum = 1;
    
    if (data.resourceSpans) {
      data.resourceSpans.forEach((rs, rsIdx) => {
        const resourceAttrs = rs.resource?.attributes || [];
        
        if (rs.scopeSpans) {
          rs.scopeSpans.forEach((ss, ssIdx) => {
            const scopeName = ss.scope?.name || 'unknown';
            
            if (ss.spans) {
              ss.spans.forEach((span, sIdx) => {
                lineNum++;
                this.processSpan({
                  ...span,
                  resourceAttributes: resourceAttrs,
                  scopeName
                }, lineNum);
              });
            }
          });
        }
      });
    }
  }

  processSpan(data, lineNum) {
    try {
      const serviceName = this.extractServiceName(data);
      const attributes = this.extractAttributes(data);
      const spanId = data.spanId || data.span_id || `span_${lineNum}`;
      const traceId = data.traceId || data.trace_id || `trace_${lineNum}`;
      const name = data.name || data.operationName || 'unknown';

      this.spans.push({
        lineNum,
        serviceName,
        spanId,
        traceId,
        name,
        attributes
      });
    } catch (e) {
      this.errors.push({
        line: lineNum,
        error: `Span processing error: ${e.message}`,
        raw: JSON.stringify(data).substring(0, 200)
      });
    }
  }

  extractServiceName(data) {
    const checks = [
      () => data.serviceName,
      () => data.service_name,
      () => data.resource?.serviceName,
      () => data.resource?.service_name,
      () => this.getAttrValue(data.resourceAttributes, 'service.name'),
      () => this.getAttrValue(data.attributes, 'service.name'),
      () => this.getAttrValue(data, 'service.name'),
      () => data.scopeName,
      () => 'unknown'
    ];

    for (const check of checks) {
      const result = check();
      if (result && result !== 'unknown') {
        return String(result);
      }
    }
    return 'unknown';
  }

  extractAttributes(data) {
    const attrs = {};
    
    if (data.attributes) {
      this.flattenAttributes(data.attributes, attrs);
    }
    
    if (data.resourceAttributes) {
      this.flattenAttributes(data.resourceAttributes, attrs);
    }
    
    if (data.resource?.attributes) {
      this.flattenAttributes(data.resource.attributes, attrs);
    }

    Object.keys(data).forEach(key => {
      if (['traceId', 'trace_id', 'spanId', 'span_id', 'name', 'parentSpanId'].includes(key)) {
        attrs[key] = data[key];
      }
    });

    return attrs;
  }

  flattenAttributes(attributes, target) {
    if (Array.isArray(attributes)) {
      attributes.forEach(attr => {
        if (attr.key) {
          const value = this.extractAttrValue(attr);
          if (value !== undefined) {
            target[attr.key] = value;
          }
        }
      });
    } else if (typeof attributes === 'object') {
      Object.keys(attributes).forEach(key => {
        if (typeof attributes[key] !== 'object' || attributes[key] === null) {
          target[key] = attributes[key];
        } else {
          const value = this.extractAttrValue(attributes[key]);
          if (value !== undefined) {
            target[key] = value;
          }
        }
      });
    }
  }

  getAttrValue(obj, key) {
    if (!obj) return null;
    
    if (Array.isArray(obj)) {
      const found = obj.find(a => a.key === key);
      return found ? this.extractAttrValue(found) : null;
    }
    
    return obj[key] || null;
  }

  extractAttrValue(attr) {
    if (attr === null || attr === undefined) return undefined;
    
    if (attr.value) {
      const v = attr.value;
      if (v.stringValue !== undefined) return v.stringValue;
      if (v.intValue !== undefined) return v.intValue;
      if (v.boolValue !== undefined) return v.boolValue;
      if (v.doubleValue !== undefined) return v.doubleValue;
      if (v.arrayValue !== undefined) return JSON.stringify(v.arrayValue);
    }
    
    if (typeof attr !== 'object') return attr;
    
    return JSON.stringify(attr);
  }

  getResult() {
    return {
      spans: this.spans,
      errors: this.errors,
      stats: {
        totalLines: this.lineNumber,
        validSpans: this.spans.length,
        parseErrors: this.errors.length
      }
    };
  }
}

module.exports = { TraceParser };
