const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class DataReader {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.requiredFiles = {
      crowdPackages: ['人群包.csv', '人群包.json'],
      channelDelivery: ['渠道投放.csv', '渠道投放.json'],
      revokeRecords: ['撤销记录.csv', '撤销记录.json']
    };
  }

  async readAll() {
    const [crowdPackages, channelDelivery, revokeRecords] = await Promise.all([
      this.readCrowdPackages(),
      this.readChannelDelivery(),
      this.readRevokeRecords()
    ]);

    return {
      crowdPackages,
      channelDelivery,
      revokeRecords
    };
  }

  async readCrowdPackages() {
    return this.readFile('crowdPackages', this.parseCrowdPackage.bind(this));
  }

  async readChannelDelivery() {
    return this.readFile('channelDelivery', this.parseChannelDelivery.bind(this));
  }

  async readRevokeRecords() {
    return this.readFile('revokeRecords', this.parseRevokeRecord.bind(this));
  }

  async readFile(fileType, parserFn) {
    for (const fileName of this.requiredFiles[fileType]) {
      const filePath = path.join(this.dataDir, fileName);
      if (fs.existsSync(filePath)) {
        if (fileName.endsWith('.csv')) {
          return this.readCSV(filePath, parserFn);
        } else if (fileName.endsWith('.json')) {
          return this.readJSON(filePath, parserFn);
        }
      }
    }
    throw new Error(`未找到${fileType}文件，支持的文件名: ${this.requiredFiles[fileType].join(', ')}`);
  }

  readCSV(filePath, parserFn) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let lineNumber = 1;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          lineNumber++;
          try {
            const parsed = parserFn(data, lineNumber);
            results.push(parsed);
          } catch (error) {
            errors.push({
              line: lineNumber,
              data: data,
              error: error.message
            });
          }
        })
        .on('end', () => {
          resolve({ data: results, errors, source: path.basename(filePath) });
        })
        .on('error', (error) => {
          reject(new Error(`读取CSV文件失败: ${error.message}`));
        });
    });
  }

  readJSON(filePath, parserFn) {
    return new Promise((resolve, reject) => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(content);
        const results = [];
        const errors = [];

        jsonData.forEach((item, index) => {
          try {
            const parsed = parserFn(item, index + 2);
            results.push(parsed);
          } catch (error) {
            errors.push({
              line: index + 2,
              data: item,
              error: error.message
            });
          }
        });

        resolve({ data: results, errors, source: path.basename(filePath) });
      } catch (error) {
        reject(new Error(`读取JSON文件失败: ${error.message}`));
      }
    });
  }

  parseCrowdPackage(data, lineNumber) {
    const packageId = data.人群包ID || data.packageId || data.id;
    const packageName = data.人群包名称 || data.packageName || data.name;
    const publishTime = data.发布时间 || data.publishTime;
    const status = data.状态 || data.status;

    if (!packageId) {
      throw new Error(`人群包ID不能为空`);
    }

    return {
      packageId: String(packageId).trim(),
      packageName: packageName ? String(packageName).trim() : '',
      publishTime: publishTime ? this.parseDate(publishTime) : null,
      status: status ? String(status).trim() : 'published',
      rawData: data
    };
  }

  parseChannelDelivery(data, lineNumber) {
    const packageId = data.人群包ID || data.packageId;
    const channelCode = data.渠道编码 || data.channelCode || data.channel;
    const channelName = data.渠道名称 || data.channelName;
    const deliveryTime = data.投放时间 || data.deliveryTime;
    const deliveryStatus = data.投放状态 || data.deliveryStatus || data.status;

    if (!packageId) {
      throw new Error(`人群包ID不能为空`);
    }
    if (!channelCode) {
      throw new Error(`渠道编码不能为空`);
    }

    return {
      packageId: String(packageId).trim(),
      channelCode: String(channelCode).trim(),
      channelName: channelName ? String(channelName).trim() : '',
      deliveryTime: deliveryTime ? this.parseDate(deliveryTime) : null,
      deliveryStatus: deliveryStatus ? String(deliveryStatus).trim() : 'delivered',
      rawData: data
    };
  }

  parseRevokeRecord(data, lineNumber) {
    const packageId = data.人群包ID || data.packageId;
    const revokeTime = data.撤销时间 || data.revokeTime;
    const revokeChannel = data.撤销渠道 || data.revokeChannel || data.channel;
    const revokeStatus = data.撤销状态 || data.revokeStatus || data.status;
    const ruleVersion = data.规则版本 || data.ruleVersion || 'v1';

    if (!packageId) {
      throw new Error(`人群包ID不能为空`);
    }
    if (!revokeTime) {
      throw new Error(`撤销时间不能为空`);
    }

    return {
      packageId: String(packageId).trim(),
      revokeTime: this.parseDate(revokeTime),
      revokeChannel: revokeChannel ? String(revokeChannel).trim() : 'all',
      revokeStatus: revokeStatus ? String(revokeStatus).trim() : 'completed',
      ruleVersion: String(ruleVersion).trim(),
      rawData: data
    };
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`无效的日期格式: ${dateStr}`);
    }
    return date;
  }
}

module.exports = DataReader;
