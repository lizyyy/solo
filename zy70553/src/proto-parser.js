const fs = require('fs');
const path = require('path');

class ProtoParser {
  constructor() {
    this.errors = [];
  }

  parse(filePath) {
    this.errors = [];
    const result = {
      file: path.basename(filePath),
      filePath,
      packages: [],
      enums: [],
      messages: [],
      services: [],
      errorCodes: [],
      parseErrors: []
    };

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      let currentPackage = '';
      let currentEnum = null;
      let braceDepth = 0;

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const rawLine = lines[lineNum];
        const line = this.stripComments(rawLine);
        const trimmed = line.trim();

        if (trimmed === '') continue;

        const packageMatch = trimmed.match(/^package\s+([\w.]+)\s*;/);
        if (packageMatch) {
          currentPackage = packageMatch[1];
          result.packages.push(currentPackage);
          continue;
        }

        const enumMatch = trimmed.match(/^enum\s+(\w+)\s*\{?/);
        if (enumMatch) {
          currentEnum = {
            name: enumMatch[1],
            package: currentPackage,
            fullName: currentPackage ? `${currentPackage}.${enumMatch[1]}` : enumMatch[1],
            values: [],
            lineStart: lineNum + 1
          };
          braceDepth = 1;
          continue;
        }

        if (currentEnum && braceDepth > 0) {
          if (trimmed.includes('{')) braceDepth++;
          if (trimmed.includes('}')) {
            braceDepth--;
            if (braceDepth === 0) {
              currentEnum.lineEnd = lineNum + 1;
              result.enums.push(currentEnum);
              if (this.looksLikeErrorEnum(currentEnum)) {
                result.errorCodes.push(...this.extractErrorCodes(currentEnum));
              }
              currentEnum = null;
              continue;
            }
          }

          const enumValueMatch = trimmed.match(/^(\w+)\s*=\s*(-?\d+)\s*;/);
          if (enumValueMatch) {
            currentEnum.values.push({
              name: enumValueMatch[1],
              value: parseInt(enumValueMatch[2], 10),
              line: lineNum + 1,
              rawLine: rawLine.trim()
            });
          }
          continue;
        }
      }

      if (result.errorCodes.length === 0) {
        for (const enumDef of result.enums) {
          for (const val of enumDef.values) {
            result.errorCodes.push({
              code: val.value,
              name: val.name,
              enumName: enumDef.fullName,
              source: 'enum',
              line: val.line,
              rawLine: val.rawLine
            });
          }
        }
      }

    } catch (error) {
      result.parseErrors.push({
        type: 'fatal',
        message: `文件解析失败: ${error.message}`,
        line: 0
      });
    }

    return result;
  }

  stripComments(line) {
    let result = '';
    let inString = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"' || line[i] === "'") {
        inString = !inString;
        result += line[i];
      } else if (!inString && line[i] === '/' && line[i + 1] === '/') {
        break;
      } else {
        result += line[i];
      }
    }
    return result;
  }

  looksLikeErrorEnum(enumDef) {
    const errorKeywords = ['error', 'code', 'status', 'err'];
    const name = enumDef.name.toLowerCase();
    return errorKeywords.some(keyword => name.includes(keyword));
  }

  extractErrorCodes(enumDef) {
    return enumDef.values.map(val => ({
      code: val.value,
      name: val.name,
      enumName: enumDef.fullName,
      source: 'error_enum',
      line: val.line,
      rawLine: val.rawLine
    }));
  }

  validateErrorCodes(errorCodes) {
    const issues = [];
    const seen = new Map();

    for (const ec of errorCodes) {
      if (ec.code === undefined || ec.code === null) {
        issues.push({
          type: 'invalid_code',
          message: `错误码值无效: ${ec.name}`,
          line: ec.line,
          rawLine: ec.rawLine
        });
        continue;
      }

      if (seen.has(ec.code)) {
        issues.push({
          type: 'duplicate_code',
          message: `重复的错误码: ${ec.code} (${ec.name} vs ${seen.get(ec.code).name})`,
          line: ec.line,
          rawLine: ec.rawLine
        });
      } else {
        seen.set(ec.code, ec);
      }

      if (typeof ec.code === 'number' && ec.code < 0) {
        issues.push({
          type: 'negative_code',
          message: `负错误码可能造成跨语言问题: ${ec.code}`,
          line: ec.line,
          rawLine: ec.rawLine
        });
      }
    }

    return issues;
  }
}

module.exports = ProtoParser;
