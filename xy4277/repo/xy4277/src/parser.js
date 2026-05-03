const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const _ = require('lodash');

class Parser {
  constructor(options = {}) {
    this.options = {
      csvDelimiter: options.csvDelimiter || ',',
      csvEncoding: options.csvEncoding || 'utf-8',
      edlEncoding: options.edlEncoding || 'utf-8',
      jsonEncoding: options.jsonEncoding || 'utf-8'
    };
    this.errors = [];
  }

  parseCSV(fileInfo, options = {}) {
    if (!fileInfo) {
      this._addError('CSV文件未指定', 'MISSING_FILE', { type: 'CSV' });
      return null;
    }

    try {
      const content = fs.readFileSync(fileInfo.fullPath, this.options.csvEncoding);
      const records = parse(content, {
        delimiter: this.options.csvDelimiter,
        columns: true,
        skip_empty_lines: true,
        trim: true,
        ...options
      });

      return this._normalizeMaterialList(records, fileInfo);
    } catch (error) {
      this._addError(`CSV文件解析失败: ${error.message}`, 'PARSE_ERROR', {
        file: fileInfo.fullPath,
        error: error.message
      });
      return null;
    }
  }

  _normalizeMaterialList(records, fileInfo) {
    const result = {
      source: fileInfo.fullPath,
      fileName: fileInfo.name,
      materials: [],
      rawData: records
    };

    const fieldMappings = {
      id: ['素材ID', '素材编号', 'ID', 'id', 'MaterialID', 'material_id', 'asset_id'],
      name: ['素材名称', '文件名', '名称', 'Name', 'name', 'filename', 'FileName'],
      type: ['类型', '素材类型', 'Type', 'type', 'category', 'Category'],
      duration: ['时长', '总时长', 'Duration', 'duration', 'length'],
      fps: ['帧率', 'FPS', 'fps', 'FrameRate'],
      resolution: ['分辨率', 'Resolution', 'resolution'],
      format: ['格式', 'Format', 'format', 'Codec'],
      source: ['来源', 'Source', 'source', 'Provider'],
      notes: ['备注', 'Notes', 'notes', '描述']
    };

    const columns = records.length > 0 ? Object.keys(records[0]) : [];
    const mappedFields = this._mapFields(columns, fieldMappings);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const material = this._extractMaterial(record, mappedFields, i + 1);
      
      if (material.id) {
        result.materials.push(material);
      } else {
        this._addError(`第${i + 1}行缺少素材ID`, 'MISSING_ID', {
          row: i + 1,
          data: record
        });
      }
    }

    return result;
  }

  _mapFields(columns, mappings) {
    const result = {};
    
    for (const [targetField, possibleNames] of Object.entries(mappings)) {
      const found = columns.find(col => 
        possibleNames.some(name => 
          col.toLowerCase() === name.toLowerCase() || 
          col.includes(name)
        )
      );
      if (found) {
        result[targetField] = found;
      }
    }

    return result;
  }

  _extractMaterial(record, mappedFields, rowNumber) {
    const material = {
      rowNumber,
      rawRecord: { ...record }
    };

    for (const [targetField, sourceField] of Object.entries(mappedFields)) {
      if (sourceField && record[sourceField] !== undefined) {
        material[targetField] = record[sourceField];
      }
    }

    if (material.duration) {
      material.durationSeconds = this._parseDuration(material.duration);
    }

    if (material.fps) {
      material.fps = parseFloat(material.fps) || material.fps;
    }

    return material;
  }

  _parseDuration(durationStr) {
    if (!durationStr) return null;

    if (typeof durationStr === 'number') {
      return durationStr;
    }

    const timecodeMatch = durationStr.match(/^(\d{2}):(\d{2}):(\d{2})([:;](\d{2,3}))?$/);
    if (timecodeMatch) {
      const hours = parseInt(timecodeMatch[1], 10);
      const minutes = parseInt(timecodeMatch[2], 10);
      const seconds = parseInt(timecodeMatch[3], 10);
      const frames = timecodeMatch[5] ? parseInt(timecodeMatch[5], 10) : 0;
      return hours * 3600 + minutes * 60 + seconds + frames / 25;
    }

    const colonMatch = durationStr.match(/^(\d+):(\d{2})(:(\d{2}))?$/);
    if (colonMatch) {
      const minutes = parseInt(colonMatch[1], 10);
      const seconds = parseInt(colonMatch[2], 10);
      const ms = colonMatch[4] ? parseInt(colonMatch[4], 10) : 0;
      return minutes * 60 + seconds + ms / 100;
    }

    const secondsMatch = durationStr.match(/^(\d+(\.\d+)?)\s*(s|sec|seconds?)?$/i);
    if (secondsMatch) {
      return parseFloat(secondsMatch[1]);
    }

    return durationStr;
  }

  parseJSON(fileInfo, options = {}) {
    if (!fileInfo) {
      this._addError('JSON文件未指定', 'MISSING_FILE', { type: 'JSON' });
      return null;
    }

    try {
      const content = fs.readFileSync(fileInfo.fullPath, this.options.jsonEncoding);
      const data = JSON.parse(content);

      return this._normalizeAuthorization(data, fileInfo);
    } catch (error) {
      this._addError(`JSON文件解析失败: ${error.message}`, 'PARSE_ERROR', {
        file: fileInfo.fullPath,
        error: error.message
      });
      return null;
    }
  }

  _normalizeAuthorization(data, fileInfo) {
    const result = {
      source: fileInfo.fullPath,
      fileName: fileInfo.name,
      contracts: [],
      rawData: data
    };

    let contracts = [];
    
    if (Array.isArray(data)) {
      contracts = data;
    } else if (data.contracts || data.authorizations || data.licenses) {
      contracts = data.contracts || data.authorizations || data.licenses;
    } else {
      contracts = [data];
    }

    for (let i = 0; i < contracts.length; i++) {
      const contract = this._normalizeContract(contracts[i], i + 1);
      if (contract.materialId || contract.assetId || contract.id) {
        result.contracts.push(contract);
      } else {
        this._addError(`合同数据第${i + 1}项缺少素材关联ID`, 'MISSING_CONTRACT_ID', {
          index: i + 1,
          data: contracts[i]
        });
      }
    }

    return result;
  }

  _normalizeContract(contract, index) {
    const normalized = {
      index,
      rawContract: { ...contract }
    };

    const idFields = ['materialId', 'material_id', 'assetId', 'asset_id', 'id', '素材ID', '素材编号'];
    for (const field of idFields) {
      if (contract[field] !== undefined) {
        normalized.materialId = contract[field];
        break;
      }
    }

    const titleFields = ['title', '名称', '合同名称', '项目名称'];
    for (const field of titleFields) {
      if (contract[field] !== undefined) {
        normalized.title = contract[field];
        break;
      }
    }

    const typeFields = ['type', '类型', '授权类型', 'licenseType'];
    for (const field of typeFields) {
      if (contract[field] !== undefined) {
        normalized.type = contract[field];
        break;
      }
    }

    const startDateFields = ['startDate', 'start_date', '开始日期', '生效日期'];
    for (const field of startDateFields) {
      if (contract[field] !== undefined) {
        normalized.startDate = contract[field];
        normalized.startDateObj = this._parseDate(contract[field]);
        break;
      }
    }

    const endDateFields = ['endDate', 'end_date', '结束日期', '到期日期', 'expiryDate', 'expirationDate'];
    for (const field of endDateFields) {
      if (contract[field] !== undefined) {
        normalized.endDate = contract[field];
        normalized.endDateObj = this._parseDate(contract[field]);
        break;
      }
    }

    const durationFields = ['maxDuration', 'max_duration', '最大时长', '允许时长', 'durationLimit'];
    for (const field of durationFields) {
      if (contract[field] !== undefined) {
        normalized.maxDuration = contract[field];
        normalized.maxDurationSeconds = this._parseDuration(contract[field].toString());
        break;
      }
    }

    const usageFields = ['usage', '用途', '使用范围', 'scope'];
    for (const field of usageFields) {
      if (contract[field] !== undefined) {
        normalized.usage = contract[field];
        break;
      }
    }

    const territoryFields = ['territory', '地区', '地域', '发行地区'];
    for (const field of territoryFields) {
      if (contract[field] !== undefined) {
        normalized.territory = contract[field];
        break;
      }
    }

    const notesFields = ['notes', '备注', '说明', '特殊条款'];
    for (const field of notesFields) {
      if (contract[field] !== undefined) {
        normalized.notes = contract[field];
        break;
      }
    }

    return normalized;
  }

  _parseDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      const cnMatch = dateStr.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
      if (cnMatch) {
        return new Date(
          parseInt(cnMatch[1], 10),
          parseInt(cnMatch[2], 10) - 1,
          parseInt(cnMatch[3], 10)
        );
      }
      
      return null;
    } catch {
      return null;
    }
  }

  parseEDL(fileInfo, options = {}) {
    if (!fileInfo) {
      this._addError('EDL文件未指定', 'MISSING_FILE', { type: 'EDL' });
      return null;
    }

    try {
      const content = fs.readFileSync(fileInfo.fullPath, this.options.edlEncoding);
      const lines = content.split(/\r?\n/);
      
      return this._parseEDLLines(lines, fileInfo);
    } catch (error) {
      this._addError(`EDL文件解析失败: ${error.message}`, 'PARSE_ERROR', {
        file: fileInfo.fullPath,
        error: error.message
      });
      return null;
    }
  }

  _parseEDLLines(lines, fileInfo) {
    const result = {
      source: fileInfo.fullPath,
      fileName: fileInfo.name,
      events: [],
      title: null,
      fcm: null,
      rawLines: lines
    };

    let currentEvent = null;
    let inComments = false;
    let eventIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;

      if (line.startsWith('TITLE:')) {
        result.title = line.substring(6).trim();
        continue;
      }

      if (line.startsWith('FCM:')) {
        result.fcm = line.substring(4).trim();
        continue;
      }

      if (line.startsWith('*')) {
        if (currentEvent) {
          this._parseCommentLine(line, currentEvent);
        }
        continue;
      }

      const eventMatch = line.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/);
      if (eventMatch) {
        if (currentEvent) {
          result.events.push(currentEvent);
        }
        
        eventIndex++;
        currentEvent = {
          index: eventIndex,
          lineNumber: i + 1,
          id: parseInt(eventMatch[1], 10),
          reel: eventMatch[2],
          trackType: eventMatch[3],
          transitionType: eventMatch[4],
          sourceIn: eventMatch[5],
          sourceOut: eventMatch[6],
          recordIn: eventMatch[7],
          recordOut: eventMatch[8],
          sourceInSeconds: this._timecodeToSeconds(eventMatch[5]),
          sourceOutSeconds: this._timecodeToSeconds(eventMatch[6]),
          recordInSeconds: this._timecodeToSeconds(eventMatch[7]),
          recordOutSeconds: this._timecodeToSeconds(eventMatch[8]),
          clipName: null,
          sourceFile: null,
          comments: []
        };

        currentEvent.durationSeconds = 
          currentEvent.sourceOutSeconds - currentEvent.sourceInSeconds;

        const fromClipMatch = line.match(/FROM\s+CLIP:\s*(.+?)(?=\s|$)/);
        if (fromClipMatch) {
          currentEvent.clipName = fromClipMatch[1].trim();
        }
      }
    }

    if (currentEvent) {
      result.events.push(currentEvent);
    }

    return result;
  }

  _parseCommentLine(line, event) {
    const content = line.substring(1).trim();
    
    const fromClipMatch = content.match(/^FROM\s+CLIP:\s*(.+)$/i);
    if (fromClipMatch) {
      event.clipName = fromClipMatch[1].trim();
    }

    const fileMatch = content.match(/^FILE:\s*(.+)$/i);
    if (fileMatch) {
      event.sourceFile = fileMatch[1].trim();
    }

    const sourceMatch = content.match(/^SOURCE\s+FILE:\s*(.+)$/i);
    if (sourceMatch) {
      event.sourceFile = sourceMatch[1].trim();
    }

    event.comments.push(content);
  }

  _timecodeToSeconds(timecode) {
    if (!timecode) return 0;

    const match = timecode.match(/^(\d{2}):(\d{2}):(\d{2})([:;])(\d{2,3})$/);
    if (!match) return 0;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const separator = match[4];
    const frames = parseInt(match[5], 10);

    const fps = separator === ';' ? 29.97 : 25;
    
    return hours * 3600 + minutes * 60 + seconds + frames / fps;
  }

  getErrors() {
    return [...this.errors];
  }

  clearErrors() {
    this.errors = [];
  }

  _addError(message, code, details = {}) {
    this.errors.push({
      message,
      code,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
}

module.exports = Parser;
