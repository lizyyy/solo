'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const gettextParser = require('gettext-parser');

function flattenObject(obj, prefix = '') {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  
  return result;
}

function unflattenObject(flatObj) {
  const result = {};
  
  for (const [key, value] of Object.entries(flatObj)) {
    const keys = key.split('.');
    let current = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  return result;
}

function parseJSON(content, filePath) {
  try {
    const parsed = JSON.parse(content);
    return {
      data: flattenObject(parsed),
      raw: parsed,
      format: 'json'
    };
  } catch (error) {
    const match = error.message.match(/position (\d+)/);
    const position = match ? parseInt(match[1]) : 0;
    const lines = content.substring(0, position).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    throw new Error(`JSON 解析错误 (${filePath})：\n  行 ${line}, 列 ${column}: ${error.message}`);
  }
}

function parseYAML(content, filePath) {
  try {
    const parsed = yaml.parse(content);
    return {
      data: flattenObject(parsed || {}),
      raw: parsed || {},
      format: 'yaml'
    };
  } catch (error) {
    let line = error.linePos ? error.linePos[0]?.line : '未知';
    let column = error.linePos ? error.linePos[0]?.col : '未知';
    
    throw new Error(`YAML 解析错误 (${filePath})：\n  行 ${line}, 列 ${column}: ${error.message}`);
  }
}

function parsePO(content, filePath) {
  try {
    const parsed = gettextParser.po.parse(content, 'utf-8');
    const translations = parsed.translations[''] || parsed.translations;
    const result = {};
    
    for (const [msgid, entry] of Object.entries(translations)) {
      if (!msgid) continue;
      
      if (entry.msgid_plural) {
        const pluralForms = entry.msgstr || [];
        result[msgid] = {
          type: 'plural',
          singular: entry.msgid,
          plural: entry.msgid_plural,
          forms: pluralForms
        };
      } else {
        result[msgid] = entry.msgstr[0] || '';
      }
    }
    
    return {
      data: result,
      raw: parsed,
      format: 'po'
    };
  } catch (error) {
    throw new Error(`PO 文件解析错误 (${filePath})：\n  ${error.message}`);
  }
}

function parseFile(filePath, fileTypes = ['.json', '.yaml', '.yml', '.po']) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (!fileTypes.includes(ext)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  switch (ext) {
    case '.json':
      return parseJSON(content, filePath);
    case '.yaml':
    case '.yml':
      return parseYAML(content, filePath);
    case '.po':
      return parsePO(content, filePath);
    default:
      return null;
  }
}

function scanLocaleDirectory(localeDir, fileTypes) {
  const languages = {};
  
  function scanDirectory(dir, lang = null) {
    if (!fs.existsSync(dir)) {
      return;
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const isLangDir = /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name) || 
                          /^[a-z]{2}_[A-Z]{2}$/.test(entry.name);
        scanDirectory(fullPath, isLangDir ? entry.name : lang);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (fileTypes.includes(ext)) {
          const baseName = path.basename(entry.name, ext);
          const langToUse = lang || detectLangFromFilename(baseName, entry.name);
          
          if (langToUse) {
            if (!languages[langToUse]) {
              languages[langToUse] = { files: [], data: {} };
            }
            
            try {
              const parsed = parseFile(fullPath, fileTypes);
              if (parsed) {
                languages[langToUse].files.push({
                  path: fullPath,
                  name: entry.name,
                  format: parsed.format
                });
                Object.assign(languages[langToUse].data, parsed.data);
              }
            } catch (error) {
              if (!languages[langToUse].errors) {
                languages[langToUse].errors = [];
              }
              languages[langToUse].errors.push(error.message);
            }
          }
        }
      }
    }
  }
  
  scanDirectory(localeDir);
  return languages;
}

function detectLangFromFilename(baseName, filename) {
  const langPatterns = [
    /^([a-z]{2}(?:-[A-Z]{2})?)$/,
    /^([a-z]{2}(?:_[A-Z]{2})?)$/,
    /\.([a-z]{2}(?:-[A-Z]{2})?)$/,
    /_([a-z]{2}(?:_[A-Z]{2})?)$/
  ];
  
  for (const pattern of langPatterns) {
    const match = baseName.match(pattern);
    if (match) {
      return match[1].replace('_', '-');
    }
  }
  
  const simpleMatch = baseName.match(/(zh-CN|zh-TW|en-US|en-GB|ja-JP|fr-FR|de-DE|es-ES)/i);
  if (simpleMatch) {
    return simpleMatch[1];
  }
  
  return null;
}

function getKeyPathInFile(key, rawData, format) {
  if (format === 'po') {
    return { file: null, line: null, column: null };
  }
  
  const keys = key.split('.');
  let current = rawData;
  let depth = 0;
  
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
      depth++;
    }
  }
  
  return { file: null, line: null, column: null };
}

module.exports = {
  flattenObject,
  unflattenObject,
  parseJSON,
  parseYAML,
  parsePO,
  parseFile,
  scanLocaleDirectory,
  detectLangFromFilename,
  getKeyPathInFile
};
