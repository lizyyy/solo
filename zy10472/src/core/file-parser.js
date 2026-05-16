const fs = require('fs').promises;
const path = require('path');

class FileParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.ext = path.extname(filePath).toLowerCase();
  }

  async parse() {
    const content = await fs.readFile(this.filePath, 'utf-8');

    if (this.ext === '.csv') {
      return this.parseCSV(content);
    } else if (this.ext === '.json') {
      return this.parseJSON(content);
    }

    throw new Error(`不支持的文件格式: ${this.ext}`);
  }

  parseCSV(content) {
    const lines = content.split('\n');
    const flags = [];
    const invalidRecords = [];
    const parseErrors = [];

    if (lines.length === 0) {
      parseErrors.push({ line: 0, error: '文件为空', source: this.filePath });
      return { flags, invalidRecords, parseErrors };
    }

    const headerLine = lines[0].trim();
    if (!headerLine) {
      parseErrors.push({ line: 1, error: '表头行为空', source: this.filePath });
      return { flags, invalidRecords, parseErrors };
    }

    const headers = this.parseCSVLine(headerLine);
    const requiredFields = ['name'];
    const missingFields = requiredFields.filter(f => !headers.includes(f));

    if (missingFields.length > 0) {
      parseErrors.push({
        line: 1,
        error: `缺少必需字段: ${missingFields.join(', ')}`,
        source: this.filePath
      });
    }

    const nameIndex = headers.indexOf('name');
    const defaultValueIndex = headers.indexOf('defaultValue');
    const statusIndex = headers.indexOf('status');
    const ownerIndex = headers.indexOf('owner');
    const descriptionIndex = headers.indexOf('description');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      if (!line) continue;

      try {
        const values = this.parseCSVLine(line);

        if (values.length < requiredFields.length) {
          invalidRecords.push({
            lineNumber,
            rawContent: line,
            source: this.filePath,
            error: `字段数量不足，期望至少 ${requiredFields.length} 个，实际 ${values.length} 个`
          });
          continue;
        }

        const name = values[nameIndex]?.trim();
        if (!name) {
          invalidRecords.push({
            lineNumber,
            rawContent: line,
            source: this.filePath,
            error: '开关名称不能为空'
          });
          continue;
        }

        if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
          parseErrors.push({
            line: lineNumber,
            error: `开关名称格式可能有问题: "${name}"`,
            source: this.filePath
          });
        }

        const flag = {
          name,
          defaultValue: defaultValueIndex >= 0 ? values[defaultValueIndex]?.trim() || null : null,
          status: statusIndex >= 0 ? values[statusIndex]?.trim() || null : null,
          owner: ownerIndex >= 0 ? values[ownerIndex]?.trim() || null : null,
          description: descriptionIndex >= 0 ? values[descriptionIndex]?.trim() || null : null,
          source: {
            file: this.filePath,
            line: lineNumber
          }
        };

        flags.push(flag);

      } catch (error) {
        invalidRecords.push({
          lineNumber,
          rawContent: line,
          source: this.filePath,
          error: error.message
        });
      }
    }

    return { flags, invalidRecords, parseErrors };
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  parseJSON(content) {
    const flags = [];
    const invalidRecords = [];
    const parseErrors = [];

    try {
      const data = JSON.parse(content);
      let items = [];

      if (Array.isArray(data)) {
        items = data;
      } else if (data.flags && Array.isArray(data.flags)) {
        items = data.flags;
      } else {
        parseErrors.push({
          line: 0,
          error: 'JSON格式不正确，根节点必须是数组或包含 flags 字段的对象',
          source: this.filePath
        });
        return { flags, invalidRecords, parseErrors };
      }

      items.forEach((item, index) => {
        const lineNumber = index + 1;

        if (!item.name || typeof item.name !== 'string') {
          invalidRecords.push({
            lineNumber,
            rawContent: JSON.stringify(item),
            source: this.filePath,
            error: '缺少 name 字段或类型错误'
          });
          return;
        }

        flags.push({
          name: item.name,
          defaultValue: item.defaultValue || null,
          status: item.status || null,
          owner: item.owner || null,
          description: item.description || null,
          source: {
            file: this.filePath,
            line: lineNumber,
            index
          }
        });
      });

    } catch (error) {
      const match = error.message.match(/at position (\d+)/);
      const position = match ? parseInt(match[1]) : 0;
      parseErrors.push({
        line: 0,
        position,
        error: `JSON解析错误: ${error.message}`,
        source: this.filePath
      });
    }

    return { flags, invalidRecords, parseErrors };
  }
}

module.exports = { FileParser };
