const fs = require('fs');
const readline = require('readline');

const LOG_FORMATS = {
  nginx: {
    pattern: /^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)" "([^"]*)"$/,
    fields: ['ip', 'user', 'time', 'method', 'url', 'protocol', 'status', 'size', 'referer', 'userAgent', 'region']
  },
  aliyun: {
    pattern: /^(\S+) \[([^\]]+)\] (\S+) (\S+) (\S+) (\d+) (\d+) "(\S+)" "([^"]*)" "([^"]*)" "(\S+)" "(\S+)" "([^"]*)"$/,
    fields: ['ip', 'time', 'region', 'isp', 'host', 'status', 'size', 'method', 'url', 'referer', 'userAgent', 'schema', 'cacheStatus']
  },
  cloudfront: {
    pattern: /^(\S+)\t(\S+)\t(\S+)\t(\d+)\t(\S+)\t(\S+)\t(\S+)\t(\d+)\t([^\t]*)\t([^\t]*)\t(\d+)\t(\d+)\t(\S+)\t(\S+)$/,
    fields: ['date', 'time', 'edgeLocation', 'size', 'ip', 'method', 'host', 'status', 'url', 'referer', 'timeTaken', 'sizeResponse', 'userAgent', 'region']
  },
  json: {
    isJson: true
  }
};

class LogParser {
  constructor(options = {}) {
    this.format = options.format || 'nginx';
    this.formatConfig = LOG_FORMATS[this.format] || LOG_FORMATS.nginx;
    this.customFields = options.fields || [];
    this.customPattern = options.pattern ? new RegExp(options.pattern) : null;
  }

  parseLine(line, lineNumber) {
    if (!line || line.trim() === '') {
      return { valid: false, error: 'empty_line', lineNumber, raw: line };
    }

    try {
      if (this.formatConfig.isJson) {
        return this.parseJsonLine(line, lineNumber);
      }
      return this.parseRegexLine(line, lineNumber);
    } catch (error) {
      return {
        valid: false,
        error: 'parse_error',
        errorMessage: error.message,
        lineNumber,
        raw: line
      };
    }
  }

  parseJsonLine(line, lineNumber) {
    const data = JSON.parse(line);
    const normalized = this.normalizeFields(data);
    return {
      valid: true,
      data: normalized,
      lineNumber,
      raw: line
    };
  }

  parseRegexLine(line, lineNumber) {
    const pattern = this.customPattern || this.formatConfig.pattern;
    const match = line.match(pattern);

    if (!match) {
      return {
        valid: false,
        error: 'pattern_mismatch',
        lineNumber,
        raw: line
      };
    }

    const fields = this.customFields.length > 0 ? this.customFields : this.formatConfig.fields;
    const data = {};

    for (let i = 0; i < fields.length; i++) {
      data[fields[i]] = match[i + 1] || '-';
    }

    const normalized = this.normalizeFields(data);
    return {
      valid: true,
      data: normalized,
      lineNumber,
      raw: line
    };
  }

  normalizeFields(data) {
    const result = { ...data };
    
    if (data.status) {
      result.status = parseInt(data.status, 10);
    }
    if (data.size) {
      result.size = parseInt(data.size, 10) || 0;
    }
    if (data.timeTaken) {
      result.timeTaken = parseFloat(data.timeTaken) || 0;
    }

    if (data.url) {
      result.resourceType = this.getResourceType(data.url);
    }

    if (!result.region && data.ip) {
      result.region = this.extractRegionFromIp(data.ip);
    }

    return result;
  }

  getResourceType(url) {
    const extMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (extMatch) {
      const ext = extMatch[1].toLowerCase();
      const typeMap = {
        'html': 'html', 'htm': 'html',
        'css': 'css',
        'js': 'javascript',
        'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image', 'svg': 'image',
        'woff': 'font', 'woff2': 'font', 'ttf': 'font', 'eot': 'font',
        'mp4': 'video', 'webm': 'video', 'avi': 'video',
        'mp3': 'audio', 'wav': 'audio',
        'json': 'json',
        'pdf': 'document', 'doc': 'document', 'docx': 'document', 'xls': 'document', 'xlsx': 'document'
      };
      return typeMap[ext] || 'other';
    }
    return 'other';
  }

  extractRegionFromIp(ip) {
    const firstOctet = parseInt(ip.split('.')[0], 10);
    if (firstOctet >= 1 && firstOctet <= 126) return 'US';
    if (firstOctet >= 128 && firstOctet <= 191) return 'EU';
    if (firstOctet >= 192 && firstOctet <= 223) return 'AP';
    return 'Unknown';
  }

  async * streamParse(filePath) {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });

    let lineNumber = 0;

    for await (const line of rl) {
      lineNumber++;
      yield this.parseLine(line, lineNumber);
    }

    rl.close();
  }

  async estimateLineCount(filePath) {
    return new Promise((resolve) => {
      let count = 0;
      const stream = fs.createReadStream(filePath);
      stream.on('data', (buffer) => {
        for (let i = 0; i < buffer.length; i++) {
          if (buffer[i] === 10) count++;
        }
      });
      stream.on('end', () => resolve(count + 1));
      stream.on('error', () => resolve(0));
    });
  }
}

module.exports = { LogParser, LOG_FORMATS };
