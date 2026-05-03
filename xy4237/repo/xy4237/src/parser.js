const fs = require('fs-extra');
const path = require('path');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const { Readable } = require('stream');
const chalk = require('chalk');

class Parser {
  constructor(options = {}) {
    this.options = {
      fieldMappings: {
        props: {
          name: ['名称', 'name', 'item', '物品', '道具名'],
          scene: ['场景', 'scene', '场', '幕'],
          cue: ['cue', 'Cue', 'CUE', '提示点', '时间点'],
          location: ['位置', 'location', '地点', '存放位置'],
          responsible: ['负责人', 'responsible', '责任人'],
          time: ['时间', 'time', '时长', '预计时间'],
          priority: ['优先级', 'priority', '重要程度'],
          notes: ['备注', 'notes', '说明'],
          category: ['分类', 'category', '类型']
        },
        lighting: {
          cueNumber: ['cue', 'Cue', 'CUE', '编号', 'cueNumber'],
          scene: ['场景', 'scene', '场'],
          description: ['描述', 'description', '说明'],
          time: ['时间', 'time'],
          responsible: ['负责人', 'responsible']
        },
        actors: {
          actor: ['演员', 'actor', '角色', '角色名'],
          scene: ['场景', 'scene', '场'],
          cue: ['cue', 'Cue', '时间点'],
          action: ['动作', 'action', '行为'],
          entrance: ['入场', 'entrance', '上场'],
          exit: ['退场', 'exit', '下场'],
          time: ['时间', 'time'],
          responsible: ['负责人', 'responsible']
        },
        notes: {
          title: ['标题', 'title', '主题', 'subject'],
          scene: ['场景', 'scene', '场'],
          cue: ['cue', 'Cue', '时间点'],
          content: ['内容', 'content', '正文'],
          responsible: ['负责人', 'responsible'],
          time: ['时间', 'time'],
          urgent: ['紧急', 'urgent', '重要']
        }
      },
      ...options
    };
  }

  async parseAll(files) {
    const result = {
      props: [],
      lighting: [],
      actors: [],
      notes: [],
      errors: [],
      raw: []
    };

    for (const file of files) {
      try {
        console.log(chalk.gray(`  解析: ${file.name}`));
        const parsed = await this.parseFile(file);
        
        if (parsed.data) {
          result.raw.push({
            file: file.name,
            category: file.category,
            data: parsed.data
          });

          // 根据文件类型归类数据
          this._categorizeData(result, file.category, parsed.data);
        }

        if (parsed.errors && parsed.errors.length > 0) {
          result.errors.push(...parsed.errors.map(e => ({
            ...e,
            file: file.name
          })));
        }
      } catch (error) {
        result.errors.push({
          file: file.name,
          message: `解析失败: ${error.message}`,
          stack: error.stack
        });
      }
    }

    return result;
  }

  async parseFile(file) {
    const extension = file.extension.toLowerCase();
    let data = null;
    let errors = [];

    try {
      switch (extension) {
        case '.xlsx':
        case '.xls':
          const xlsxResult = await this.parseXLSX(file.path);
          data = xlsxResult.data;
          errors = xlsxResult.errors || [];
          break;

        case '.csv':
          const csvResult = await this.parseCSV(file.path);
          data = csvResult.data;
          errors = csvResult.errors || [];
          break;

        case '.json':
          const jsonResult = await this.parseJSON(file.path);
          data = jsonResult.data;
          errors = jsonResult.errors || [];
          break;

        case '.md':
        case '.txt':
          const textResult = await this.parseText(file.path);
          data = textResult.data;
          errors = textResult.errors || [];
          break;

        default:
          errors.push({
            message: `不支持的文件格式: ${extension}`
          });
      }
    } catch (error) {
      errors.push({
        message: `解析异常: ${error.message}`
      });
    }

    return { data, errors };
  }

  async parseXLSX(filePath) {
    const data = [];
    const errors = [];

    try {
      const workbook = XLSX.readFile(filePath);
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          defval: '',
          raw: false
        });

        if (jsonData.length > 0) {
          const normalizedData = jsonData.map(row => this._normalizeRow(row, sheetName));
          data.push({
            sheet: sheetName,
            rows: normalizedData
          });
        }
      }
    } catch (error) {
      errors.push({ message: `XLSX解析错误: ${error.message}` });
    }

    return { data, errors };
  }

  async parseCSV(filePath) {
    return new Promise((resolve) => {
      const rows = [];
      const errors = [];

      const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
      
      stream
        .pipe(csv())
        .on('data', (row) => {
          rows.push(this._normalizeRow(row, 'csv'));
        })
        .on('end', () => {
          resolve({
            data: [{ sheet: 'csv', rows }],
            errors
          });
        })
        .on('error', (error) => {
          errors.push({ message: `CSV解析错误: ${error.message}` });
          resolve({ data: null, errors });
        });
    });
  }

  async parseJSON(filePath) {
    const errors = [];
    let data = null;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const json = JSON.parse(content);
      
      // 支持多种JSON格式
      if (Array.isArray(json)) {
        data = [{ sheet: 'json', rows: json.map(r => this._normalizeRow(r, 'json')) }];
      } else if (json.cues || json.lighting || json.data) {
        const items = json.cues || json.lighting || json.data;
        if (Array.isArray(items)) {
          data = [{ sheet: 'json', rows: items.map(r => this._normalizeRow(r, 'json')) }];
        }
      } else {
        // 尝试作为单个对象处理
        data = [{ sheet: 'json', rows: [this._normalizeRow(json, 'json')] }];
      }
    } catch (error) {
      errors.push({ message: `JSON解析错误: ${error.message}` });
    }

    return { data, errors };
  }

  async parseText(filePath) {
    const errors = [];
    const data = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      const rows = this._parseTextToRows(lines);
      if (rows.length > 0) {
        data.push({ sheet: 'text', rows });
      }
    } catch (error) {
      errors.push({ message: `文本解析错误: ${error.message}` });
    }

    return { data, errors };
  }

  _normalizeRow(row, context) {
    const normalized = {};
    
    for (const [key, value] of Object.entries(row)) {
      // 去除空格
      const cleanKey = key.trim();
      const cleanValue = typeof value === 'string' ? value.trim() : value;
      
      // 尝试标准化字段名
      const mappedKey = this._mapField(cleanKey);
      normalized[mappedKey || cleanKey.toLowerCase()] = cleanValue;
      
      // 同时保留原始键名
      if (mappedKey && mappedKey !== cleanKey.toLowerCase()) {
        normalized[cleanKey.toLowerCase()] = cleanValue;
      }
    }

    // 尝试解析时间字段
    this._parseTimeFields(normalized);

    return normalized;
  }

  _mapField(fieldName) {
    const lowerName = fieldName.toLowerCase();
    
    for (const [category, mappings] of Object.entries(this.options.fieldMappings)) {
      for (const [standardField, alternatives] of Object.entries(mappings)) {
        if (alternatives.some(alt => alt.toLowerCase() === lowerName)) {
          return standardField;
        }
      }
    }
    
    return null;
  }

  _parseTimeFields(row) {
    const timeFields = ['time', 'duration', '时长'];
    
    for (const field of timeFields) {
      if (row[field]) {
        const value = row[field];
        if (typeof value === 'string') {
          // 尝试解析 "3:30" 格式为秒
          const match = value.match(/(\d+):(\d+)/);
          if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            row[`${field}_seconds`] = minutes * 60 + seconds;
          } else if (!isNaN(parseFloat(value))) {
            row[`${field}_seconds`] = parseFloat(value);
          }
        }
      }
    }
  }

  _parseTextToRows(lines) {
    const rows = [];
    let currentRow = null;
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 标题行
      if (line.startsWith('#') || line.startsWith('【') || line.match(/^第[一二三四五六七八九十\d]+[场幕]/)) {
        if (currentRow) {
          rows.push(currentRow);
        }
        currentRow = {
          title: line.replace(/^[#【]+|【]+$/g, '').trim()
        };
        inList = false;
        continue;
      }

      // 列表项
      if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
        inList = true;
        if (!currentRow) currentRow = {};
        if (!currentRow.items) currentRow.items = [];
        currentRow.items.push(line.replace(/^[-*•]+/, '').trim());
        continue;
      }

      // 键值对
      const colonMatch = line.match(/^(.+?)[：:](.+)$/);
      if (colonMatch && currentRow) {
        const key = colonMatch[1].trim();
        const value = colonMatch[2].trim();
        const mappedKey = this._mapField(key) || key.toLowerCase();
        currentRow[mappedKey] = value;
      } else if (currentRow && !inList) {
        // 普通文本追加到内容
        if (!currentRow.content) currentRow.content = '';
        currentRow.content += (currentRow.content ? '\n' : '') + line;
      }
    }

    if (currentRow) {
      rows.push(currentRow);
    }

    return rows;
  }

  _categorizeData(result, category, data) {
    if (!data || !Array.isArray(data)) return;

    for (const sheet of data) {
      if (!sheet.rows || !Array.isArray(sheet.rows)) continue;

      for (const row of sheet.rows) {
        switch (category) {
          case 'props':
            if (row.name || row.item) {
              result.props.push(row);
            }
            break;

          case 'lighting':
            if (row.cueNumber !== undefined || row.cue !== undefined) {
              result.lighting.push(row);
            }
            break;

          case 'actors':
            if (row.actor || row.action) {
              result.actors.push(row);
            }
            break;

          case 'notes':
          case 'unknown':
            // 未知类型尝试推断
            if (row.title || row.content || row.subject) {
              result.notes.push(row);
            } else if (row.actor || row.action) {
              result.actors.push(row);
            } else if (row.cueNumber !== undefined || (row.cue && !row.name)) {
              result.lighting.push(row);
            } else if (row.name || row.item) {
              result.props.push(row);
            }
            break;
        }
      }
    }
  }

  validateFields(data, category) {
    const issues = [];
    const requiredFields = {
      props: ['name', 'scene'],
      lighting: ['cueNumber'],
      actors: ['actor'],
      notes: ['title']
    };

    const fields = requiredFields[category] || [];
    
    data.forEach((row, index) => {
      for (const field of fields) {
        if (!row[field] && row[field] !== 0) {
          issues.push({
            type: 'warning',
            message: `第 ${index + 1} 行缺少必填字段: ${field}`,
            row: index
          });
        }
      }
    });

    return issues;
  }
}

module.exports = Parser;
