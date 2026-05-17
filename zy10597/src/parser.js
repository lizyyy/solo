const fs = require('fs');
const path = require('path');
const tough = require('tough-cookie');

class CookieParser {
  constructor() {
    this.supportedFormats = ['json', 'netscape', 'har'];
  }

  parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf-8');
    
    try {
      if (ext === '.json') {
        return this.parseJSON(content, filePath);
      } else if (ext === '.har') {
        return this.parseHAR(content, filePath);
      } else {
        return this.parseNetscape(content, filePath);
      }
    } catch (error) {
      return {
        success: false,
        filePath,
        error: error.message,
        cookies: []
      };
    }
  }

  parseJSON(content, filePath) {
    const data = JSON.parse(content);
    const cookies = [];
    
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        try {
          const cookie = this.normalizeCookie(item);
          cookies.push({ ...cookie, source: filePath, index });
        } catch (e) {
          cookies.push({
            raw: item,
            source: filePath,
            index,
            parseError: e.message
          });
        }
      });
    } else if (data.cookies && Array.isArray(data.cookies)) {
      data.cookies.forEach((item, index) => {
        try {
          const cookie = this.normalizeCookie(item);
          cookies.push({ ...cookie, source: filePath, index });
        } catch (e) {
          cookies.push({
            raw: item,
            source: filePath,
            index,
            parseError: e.message
          });
        }
      });
    }

    return {
      success: true,
      filePath,
      format: 'json',
      cookies
    };
  }

  parseHAR(content, filePath) {
    const data = JSON.parse(content);
    const cookies = [];
    
    if (data.log && data.log.entries && Array.isArray(data.log.entries)) {
      data.log.entries.forEach((entry, entryIndex) => {
        if (entry.response && entry.response.cookies) {
          entry.response.cookies.forEach((item, cookieIndex) => {
            try {
              const cookie = this.normalizeCookie(item);
              cookies.push({ 
                ...cookie, 
                source: filePath, 
                entryIndex, 
                cookieIndex 
              });
            } catch (e) {
              cookies.push({
                raw: item,
                source: filePath,
                entryIndex,
                cookieIndex,
                parseError: e.message
              });
            }
          });
        }
        if (entry.request && entry.request.cookies) {
          entry.request.cookies.forEach((item, cookieIndex) => {
            try {
              const cookie = this.normalizeCookie(item);
              cookies.push({ 
                ...cookie, 
                source: filePath, 
                entryIndex, 
                cookieIndex,
                from: 'request'
              });
            } catch (e) {
              cookies.push({
                raw: item,
                source: filePath,
                entryIndex,
                cookieIndex,
                from: 'request',
                parseError: e.message
              });
            }
          });
        }
      });
    }

    return {
      success: true,
      filePath,
      format: 'har',
      cookies
    };
  }

  parseNetscape(content, filePath) {
    const lines = content.split('\n');
    const cookies = [];
    
    lines.forEach((line, index) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      
      try {
        const parts = line.split('\t');
        if (parts.length >= 6) {
          const cookie = {
            domain: parts[0],
            flag: parts[1] === 'TRUE',
            path: parts[2],
            secure: parts[3] === 'TRUE',
            expires: parts[4] ? parseInt(parts[4]) * 1000 : null,
            name: parts[5],
            value: parts[6] || ''
          };
          cookies.push({
            ...this.normalizeCookie(cookie),
            source: filePath,
            line: index + 1
          });
        }
      } catch (e) {
        cookies.push({
          raw: line,
          source: filePath,
          line: index + 1,
          parseError: e.message
        });
      }
    });

    return {
      success: true,
      filePath,
      format: 'netscape',
      cookies
    };
  }

  normalizeCookie(item) {
    const cookie = {
      name: item.name || item.key || '',
      value: item.value || '',
      domain: item.domain || '',
      path: item.path || '/',
      secure: item.secure || false,
      httpOnly: item.httpOnly || item.httponly || false,
      sameSite: item.sameSite || item.samesite || 'Lax',
      expires: null
    };

    if (item.expires) {
      if (typeof item.expires === 'string') {
        cookie.expires = new Date(item.expires).getTime();
      } else if (typeof item.expires === 'number') {
        cookie.expires = item.expires > 9999999999 ? item.expires : item.expires * 1000;
      }
    }

    if (item.expiry) {
      cookie.expires = item.expiry > 9999999999 ? item.expiry : item.expiry * 1000;
    }

    cookie.sameSite = this.normalizeSameSite(cookie.sameSite);

    return cookie;
  }

  normalizeSameSite(sameSite) {
    if (!sameSite) return 'Lax';
    const s = String(sameSite).toLowerCase();
    if (s === 'strict') return 'Strict';
    if (s === 'lax') return 'Lax';
    if (s === 'none') return 'None';
    return 'Lax';
  }

  parseDirectory(dirPath) {
    const results = [];
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (['.json', '.har', '.txt', '.cookies'].includes(ext)) {
          results.push(this.parseFile(fullPath));
        }
      }
    });

    return results;
  }
}

module.exports = CookieParser;
