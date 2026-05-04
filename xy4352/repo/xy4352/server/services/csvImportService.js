const csv = require('csv-parser');
const { Readable } = require('stream');
const dayjs = require('dayjs');
const { WaterSample } = require('../models');
const RiskDetectionService = require('./riskDetectionService');

class CsvImportService {
  static async importFromBuffer(buffer, filename, operator = null) {
    const results = [];
    const errors = [];
    
    return new Promise((resolve, reject) => {
      const stream = Readable.from(buffer.toString());
      
      stream
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim()
        }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          try {
            const importResult = await this.processImportData(results, filename, operator);
            resolve(importResult);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  static async processImportData(rows, filename, operator = null) {
    const importedSamples = [];
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;
      
      try {
        const sample = await this.parseRow(row, filename, operator);
        if (sample) {
          const existingSample = await WaterSample.findOne({
            where: {
              samplePoint: sample.samplePoint,
              sampleTime: sample.sampleTime
            }
          });
          
          if (existingSample) {
            await existingSample.update(sample);
            importedSamples.push(existingSample);
          } else {
            const newSample = await WaterSample.create(sample);
            importedSamples.push(newSample);
          }
          successCount++;
        }
      } catch (error) {
        errors.push({
          row: rowNumber,
          error: error.message
        });
        errorCount++;
      }
    }

    if (importedSamples.length > 0) {
      console.log(`开始风险检测...`);
      const risks = await RiskDetectionService.detectAllRisks();
      console.log(`风险检测完成，发现 ${risks.length} 个风险`);
    }

    return {
      success: true,
      filename,
      total: rows.length,
      successCount,
      errorCount,
      errors,
      sampleIds: importedSamples.map(s => s.id)
    };
  }

  static parseRow(row, filename, operator = null) {
    const samplePoint = this.parseSamplePoint(row);
    const sampleTime = this.parseSampleTime(row);
    
    if (!samplePoint) {
      throw new Error('采样点不能为空');
    }
    
    if (!sampleTime) {
      throw new Error('采样时间不能为空或格式错误');
    }

    const sample = {
      samplePoint,
      sampleTime,
      sourceFile: filename,
      operator: operator || row.operator || row.当班人员 || null
    };

    const parameters = [
      { key: 'chlorine', aliases: ['余氯', 'chlorine', 'free_chlorine', '游离氯'], required: true },
      { key: 'ph', aliases: ['ph', 'pH', 'PH', '酸碱度'], required: true },
      { key: 'turbidity', aliases: ['浊度', 'turbidity', '浑浊度'], required: true },
      { key: 'temperature', aliases: ['水温', 'temperature', '温度'], required: true }
    ];

    for (const param of parameters) {
      const value = this.parseParameterValue(row, param.aliases);
      if (value === null && param.required) {
        throw new Error(`参数 ${param.key} 解析失败或为空`);
      }
      sample[param.key] = value;
    }

    return sample;
  }

  static parseSamplePoint(row) {
    const aliases = ['采样点', 'sample_point', 'samplePoint', 'location', '点位', '地点'];
    for (const alias of aliases) {
      if (row[alias] && String(row[alias]).trim()) {
        return String(row[alias]).trim();
      }
    }
    return null;
  }

  static parseSampleTime(row) {
    const aliases = ['时间', '采样时间', 'sample_time', 'sampleTime', 'time', 'timestamp', '日期时间'];
    
    for (const alias of aliases) {
      if (row[alias]) {
        const timeStr = String(row[alias]).trim();
        
        const formats = [
          'YYYY-MM-DD HH:mm:ss',
          'YYYY-MM-DD HH:mm',
          'YYYY/MM/DD HH:mm:ss',
          'YYYY/MM/DD HH:mm',
          'MM-DD-YYYY HH:mm:ss',
          'MM/DD/YYYY HH:mm:ss'
        ];
        
        for (const format of formats) {
          const parsed = dayjs(timeStr, format, true);
          if (parsed.isValid()) {
            return parsed.toDate();
          }
        }
        
        const directParse = dayjs(timeStr);
        if (directParse.isValid()) {
          return directParse.toDate();
        }
      }
    }
    
    return null;
  }

  static parseParameterValue(row, aliases) {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null) {
        const valueStr = String(row[alias]).trim();
        if (valueStr === '') continue;
        
        const value = parseFloat(valueStr);
        if (!isNaN(value)) {
          return value;
        }
      }
    }
    return null;
  }

  static getSampleTemplate() {
    return {
      headers: [
        '采样点',
        '时间',
        '余氯',
        'pH',
        '浊度',
        '水温',
        '当班人员'
      ],
      example: [
        {
          '采样点': '浅水池1号',
          '时间': '2024-01-15 09:00:00',
          '余氯': 0.4,
          'pH': 7.5,
          '浊度': 0.5,
          '水温': 25,
          '当班人员': '张三'
        },
        {
          '采样点': '深水池2号',
          '时间': '2024-01-15 10:00:00',
          '余氯': 0.35,
          'pH': 7.8,
          '浊度': 0.3,
          '水温': 24.5,
          '当班人员': '张三'
        }
      ]
    };
  }
}

module.exports = CsvImportService;
