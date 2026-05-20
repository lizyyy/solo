const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Showtime = require('../models/Showtime');
const BoxOffice = require('../models/BoxOffice');
const ContractRule = require('../models/ContractRule');

class FileParserService {
  static async parseCSV(filePath, ModelClass, options = {}) {
    const results = [];
    const skipLines = options.skipLines || 0;
    let lineNumber = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({ separator: options.separator || ',' }))
        .on('data', (data) => {
          lineNumber++;
          if (lineNumber > skipLines) {
            const instance = new ModelClass(data);
            instance.sourceFile = path.basename(filePath);
            instance.lineNumber = lineNumber;
            results.push(instance);
          }
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  static async parseJSON(filePath, ModelClass = null) {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    if (ModelClass) {
      if (Array.isArray(data)) {
        return data.map((item, index) => {
          const instance = new ModelClass(item);
          instance.sourceFile = path.basename(filePath);
          instance.lineNumber = index + 1;
          return instance;
        });
      }
      const instance = new ModelClass(data);
      instance.sourceFile = path.basename(filePath);
      return instance;
    }
    
    return data;
  }

  static async parseShowtimesCSV(filePath) {
    return this.parseCSV(filePath, Showtime);
  }

  static async parseBoxOfficeJSON(filePath) {
    const data = await this.parseJSON(filePath);
    if (Array.isArray(data)) {
      return data.map((item, index) => {
        const boxOffice = new BoxOffice(item);
        boxOffice.sourceFile = path.basename(filePath);
        boxOffice.lineNumber = index + 1;
        return boxOffice;
      });
    }
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((item, index) => {
        const boxOffice = new BoxOffice(item);
        boxOffice.sourceFile = path.basename(filePath);
        boxOffice.lineNumber = index + 1;
        return boxOffice;
      });
    }
    const boxOffice = new BoxOffice(data);
    boxOffice.sourceFile = path.basename(filePath);
    return [boxOffice];
  }

  static async parseContractRulesJSON(filePath) {
    const data = await this.parseJSON(filePath);
    let rules = [];
    
    if (Array.isArray(data)) {
      rules = data;
    } else if (data.rules && Array.isArray(data.rules)) {
      rules = data.rules;
    } else if (data.data && Array.isArray(data.data)) {
      rules = data.data;
    } else {
      rules = [data];
    }
    
    return rules.map((item, index) => {
      const rule = new ContractRule(item);
      rule.sourceFile = path.basename(filePath);
      rule.lineNumber = index + 1;
      return rule;
    });
  }

  static async parseUploadedFiles(files) {
    const result = {
      showtimes: [],
      boxOffices: [],
      contractRules: [],
      errors: []
    };

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const fileName = file.originalname.toLowerCase();

      try {
        if (ext === '.csv' && fileName.includes('showtime')) {
          result.showtimes = await this.parseShowtimesCSV(file.path);
        } else if (ext === '.csv' && fileName.includes('场次')) {
          result.showtimes = await this.parseShowtimesCSV(file.path);
        } else if (ext === '.json' && fileName.includes('boxoffice')) {
          result.boxOffices = await this.parseBoxOfficeJSON(file.path);
        } else if (ext === '.json' && fileName.includes('票房')) {
          result.boxOffices = await this.parseBoxOfficeJSON(file.path);
        } else if (ext === '.json' && fileName.includes('contract')) {
          result.contractRules = await this.parseContractRulesJSON(file.path);
        } else if (ext === '.json' && fileName.includes('规则')) {
          result.contractRules = await this.parseContractRulesJSON(file.path);
        } else if (ext === '.csv') {
          const parsed = await this.parseCSV(file.path, Showtime);
          if (parsed.length > 0 && parsed[0].filmId && parsed[0].showDate) {
            result.showtimes = parsed;
          }
        } else if (ext === '.json') {
          try {
            const parsed = await this.parseJSON(file.path);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (parsed[0].ruleName || parsed[0].subsidyAmount) {
                result.contractRules = parsed.map(item => new ContractRule(item));
              } else if (parsed[0].totalBoxOffice !== undefined) {
                result.boxOffices = parsed.map(item => new BoxOffice(item));
              }
            }
          } catch (e) {
            result.errors.push(`文件 ${file.originalname} 解析失败: ${e.message}`);
          }
        }
      } catch (error) {
        result.errors.push(`文件 ${file.originalname} 处理失败: ${error.message}`);
      }
    }

    return result;
  }

  static deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

module.exports = FileParserService;
