const fs = require('fs');
const path = require('path');

class DotenvParser {
  constructor() {
    this.name = 'dotenv';
    this.priority = 10;
  }

  parse(filePath) {
    const result = {
      source: filePath,
      type: 'dotenv',
      variables: [],
      errors: []
    };

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith('#')) {
          return;
        }

        const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

        if (match) {
          const [, name, rawValue] = match;
          let value = rawValue.trim();

          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');

          result.variables.push({
            name,
            value,
            rawValue,
            lineNumber,
            source: filePath,
            sourceType: 'dotenv',
            priority: this.priority
          });
        } else if (trimmedLine) {
          result.errors.push({
            type: 'BAD_LINE',
            message: `无法解析的变量格式`,
            line: trimmedLine,
            lineNumber,
            source: filePath
          });
        }
      });
    } catch (error) {
      result.errors.push({
        type: 'FILE_ERROR',
        message: `文件读取失败: ${error.message}`,
        source: filePath
      });
    }

    return result;
  }

  canParse(filePath) {
    const basename = path.basename(filePath);
    return basename === '.env' ||
           basename.startsWith('.env.') ||
           basename.endsWith('.env');
  }
}

module.exports = DotenvParser;
