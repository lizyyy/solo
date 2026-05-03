const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const dayjs = require('dayjs');

class NoteParser {
  constructor() {
    this.notes = [];
  }

  async parseFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`备注数据文件不存在: ${filePath}`));
      }

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const note = this.parseRow(row);
          if (note) {
            results.push(note);
          }
        })
        .on('end', () => {
          const sortedResults = this.sortByTime(results);
          this.notes = sortedResults;
          resolve(sortedResults);
        })
        .on('error', (error) => {
          reject(new Error(`解析备注数据失败: ${error.message}`));
        });
    });
  }

  parseRow(row) {
    try {
      const timeField = this.findTimeField(row);
      const noteField = this.findNoteField(row);
      const vehicleField = this.findVehicleField(row);
      const categoryField = this.findCategoryField(row);

      if (!noteField) {
        return null;
      }

      const content = row[noteField]?.toString().trim();
      if (!content) {
        return null;
      }

      let timestamp = null;
      let timeStr = '';
      if (timeField) {
        const timeValue = row[timeField];
        if (timeValue) {
          const parsedTime = dayjs(timeValue);
          if (parsedTime.isValid()) {
            timestamp = parsedTime.toISOString();
            timeStr = timeValue;
          }
        }
      }

      if (!timestamp) {
        const extractedTime = this.extractTimeFromContent(content);
        if (extractedTime) {
          timestamp = extractedTime.toISOString();
          timeStr = extractedTime.format('YYYY-MM-DD HH:mm:ss');
        }
      }

      const anomalyKeywords = [
        '超温', '温度高', '温度异常', '故障', '问题', '异常', 
        '报警', '温度低', '冻结', '解冻', '压缩机', '空调',
        '开门超时', '门没关', '忘记关门', '温度波动',
        'overtemp', 'high temp', 'abnormal', 'fault', 'problem'
      ];

      const isAnomalyRelated = anomalyKeywords.some(
        keyword => content.toLowerCase().includes(keyword.toLowerCase())
      );

      const extractedInfo = this.extractInformation(content);

      return {
        timestamp,
        time: timeStr,
        content,
        vehicle: row[vehicleField] || extractedInfo.vehicle || 'unknown',
        category: row[categoryField] || extractedInfo.category || 'general',
        isAnomalyRelated,
        extractedTemperature: extractedInfo.temperature,
        extractedDuration: extractedInfo.duration,
        source: 'note'
      };
    } catch (error) {
      return null;
    }
  }

  findTimeField(row) {
    const possibleFields = ['时间', 'time', 'timestamp', 'datetime', '日期时间', '日期', '记录时间'];
    for (const field of possibleFields) {
      if (row.hasOwnProperty(field)) {
        return field;
      }
      const lowerField = field.toLowerCase();
      const matchedField = Object.keys(row).find(
        key => key.toLowerCase().includes(lowerField)
      );
      if (matchedField) {
        return matchedField;
      }
    }
    return null;
  }

  findNoteField(row) {
    const possibleFields = ['备注', 'note', '内容', 'content', '描述', 'description', '交接记录', '说明'];
    for (const field of possibleFields) {
      if (row.hasOwnProperty(field)) {
        return field;
      }
      const lowerField = field.toLowerCase();
      const matchedField = Object.keys(row).find(
        key => key.toLowerCase().includes(lowerField)
      );
      if (matchedField) {
        return matchedField;
      }
    }
    return null;
  }

  findVehicleField(row) {
    const possibleFields = ['车辆', 'vehicle', '车牌', '车牌号', '车号', 'vehicle_id', '运输车辆'];
    for (const field of possibleFields) {
      if (row.hasOwnProperty(field)) {
        return field;
      }
      const lowerField = field.toLowerCase();
      const matchedField = Object.keys(row).find(
        key => key.toLowerCase().includes(lowerField)
      );
      if (matchedField) {
        return matchedField;
      }
    }
    return null;
  }

  findCategoryField(row) {
    const possibleFields = ['类别', 'category', '类型', 'type', '分类', '问题类型'];
    for (const field of possibleFields) {
      if (row.hasOwnProperty(field)) {
        return field;
      }
      const lowerField = field.toLowerCase();
      const matchedField = Object.keys(row).find(
        key => key.toLowerCase().includes(lowerField)
      );
      if (matchedField) {
        return matchedField;
      }
    }
    return null;
  }

  extractTimeFromContent(content) {
    const patterns = [
      /(\d{4})-(\d{2})-(\d{2})\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/,
      /(\d{4})\/(\d{2})\/(\d{2})\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/,
      /(\d{2})-(\d{2})-(\d{4})\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/,
      /昨天\s*(\d{1,2})点(\d{2})分/,
      /今天\s*(\d{1,2})点(\d{2})分/,
      /(\d{1,2})月(\d{1,2})日\s*(\d{1,2})时(\d{2})分/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const now = dayjs();
        if (pattern.toString().includes('昨天')) {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          return now.subtract(1, 'day').hour(hour).minute(minute).second(0);
        }
        if (pattern.toString().includes('今天')) {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          return now.hour(hour).minute(minute).second(0);
        }
        if (pattern.toString().includes('月')) {
          const month = parseInt(match[1]);
          const day = parseInt(match[2]);
          const hour = parseInt(match[3]);
          const minute = parseInt(match[4]);
          return now.month(month - 1).date(day).hour(hour).minute(minute).second(0);
        }
      }
    }
    return null;
  }

  extractInformation(content) {
    const result = {
      temperature: null,
      duration: null,
      vehicle: null,
      category: null
    };

    const tempPatterns = [
      /(\d+(?:\.\d+)?)\s*℃/,
      /温度[：:]\s*(\d+(?:\.\d+)?)/,
      /达到?\s*(\d+(?:\.\d+)?)\s*度/
    ];

    for (const pattern of tempPatterns) {
      const match = content.match(pattern);
      if (match) {
        result.temperature = parseFloat(match[1]);
        break;
      }
    }

    const durationPatterns = [
      /(\d+(?:\.\d+)?)\s*小时/,
      /(\d+(?:\.\d+)?)\s*分钟/,
      /持续[：:]\s*(\d+(?:\.\d+)?)/
    ];

    for (const pattern of durationPatterns) {
      const match = content.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        if (pattern.toString().includes('小时')) {
          result.duration = value * 60;
        } else {
          result.duration = value;
        }
        break;
      }
    }

    const vehiclePatterns = [
      /(?:车辆|车牌|车号)[：:]?\s*([\u4e00-\u9fa50-9]+)/,
      /([京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-Z0-9]{5})/
    ];

    for (const pattern of vehiclePatterns) {
      const match = content.match(pattern);
      if (match) {
        result.vehicle = match[1];
        break;
      }
    }

    const categoryKeywords = {
      'temperature': ['温度', '超温', '高温', '低温'],
      'door': ['开门', '门', '关门'],
      'equipment': ['设备', '故障', '压缩机', '空调', '机组'],
      'operation': ['操作', '人工', '搬运', '装卸']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          result.category = category;
          break;
        }
      }
      if (result.category) break;
    }

    return result;
  }

  sortByTime(notes) {
    return notes.sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf();
    });
  }

  getNotesByTimeRange(startTime, endTime) {
    const start = dayjs(startTime);
    const end = dayjs(endTime);

    return this.notes.filter(note => {
      if (!note.timestamp) return false;
      const noteTime = dayjs(note.timestamp);
      return noteTime.isAfter(start) && noteTime.isBefore(end);
    });
  }

  getAnomalyNotes() {
    return this.notes.filter(note => note.isAnomalyRelated);
  }

  getVehicles() {
    return [...new Set(this.notes.map(n => n.vehicle).filter(v => v && v !== 'unknown'))];
  }
}

module.exports = NoteParser;
