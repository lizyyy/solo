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

  static normalizeFileName(name) {
    return name.toLowerCase().replace(/[_\-\s]/g, '');
  }

  static hasField(obj, ...fieldNames) {
    for (const name of fieldNames) {
      if (obj[name] !== undefined) return true;
    }
    return false;
  }

  static detectJsonContentType(data) {
    const sample = Array.isArray(data) ? data[0] : data;
    if (!sample || typeof sample !== 'object') return null;

    if (this.hasField(sample, 'ruleName', 'rule_name', 'subsidyAmount', 'subsidy_amount')) {
      return 'contractRules';
    }
    if (this.hasField(sample, 'totalBoxOffice', 'total_box_office', 'netBoxOffice', 'net_box_office', 'statDate', 'stat_date')) {
      return 'boxOffices';
    }
    if (this.hasField(sample, 'showDate', 'show_date', 'startTime', 'start_time', 'soldSeats', 'sold_seats')) {
      return 'showtimes';
    }
    return null;
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
      const normalizedName = this.normalizeFileName(file.originalname);

      try {
        if (ext === '.csv' && (fileName.includes('showtime') || fileName.includes('场次') || normalizedName.includes('showtimes'))) {
          result.showtimes = await this.parseShowtimesCSV(file.path);
        } else if (ext === '.json' && (normalizedName.includes('boxoffice') || fileName.includes('票房'))) {
          result.boxOffices = await this.parseBoxOfficeJSON(file.path);
        } else if (ext === '.json' && (normalizedName.includes('contract') || fileName.includes('规则') || normalizedName.includes('rules'))) {
          result.contractRules = await this.parseContractRulesJSON(file.path);
        } else if (ext === '.csv') {
          const parsed = await this.parseCSV(file.path, Showtime);
          if (parsed.length > 0 && (parsed[0].filmId || parsed[0].showDate)) {
            result.showtimes = parsed;
          }
        } else if (ext === '.json') {
          try {
            const parsed = await this.parseJSON(file.path);
            const contentType = this.detectJsonContentType(parsed);
            
            if (contentType === 'contractRules') {
              const rules = Array.isArray(parsed) ? parsed : (parsed.rules || parsed.data || [parsed]);
              result.contractRules = rules.map(item => new ContractRule(item));
            } else if (contentType === 'boxOffices') {
              const boxOffices = Array.isArray(parsed) ? parsed : (parsed.data || [parsed]);
              result.boxOffices = boxOffices.map(item => new BoxOffice(item));
            } else if (contentType === 'showtimes') {
              const showtimes = Array.isArray(parsed) ? parsed : (parsed.data || [parsed]);
              result.showtimes = showtimes.map(item => new Showtime(item));
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
