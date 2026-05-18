const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const chalk = require('chalk');

class RoastingCurveCompare {
  constructor(options) {
    this.inputDir = options.inputDir;
    this.outputDir = options.outputDir;
    this.templateFile = options.templateFile;
    this.sensorGapThreshold = options.sensorGapThreshold;
    this.batchThreshold = options.batchThreshold;
    this.anomalies = [];
    this.totalFiles = 0;
  }

  async run() {
    const files = this.getCsvFiles(this.inputDir);
    this.totalFiles = files.length;

    console.log(chalk.cyan(`找到 ${files.length} 个烘焙曲线文件`));
    console.log();

    const allCurves = [];

    for (const file of files) {
      console.log(chalk.magenta(`处理文件: ${path.basename(file)}`));
      const curveData = await this.parseCsvFile(file);
      allCurves.push({ file, data: curveData });

      const fileAnomalies = this.analyzeCurve(file, curveData);
      this.anomalies.push(...fileAnomalies);
      
      if (fileAnomalies.length > 0) {
        console.log(chalk.yellow(`  发现 ${fileAnomalies.length} 个异常`));
      } else {
        console.log(chalk.green(`  无异常`));
      }
    }

    if (allCurves.length >= 2) {
      const batchAnomalies = this.detectBatchMerge(allCurves);
      this.anomalies.push(...batchAnomalies);
      if (batchAnomalies.length > 0) {
        console.log();
        console.log(chalk.yellow(`拼批检测: 发现 ${batchAnomalies.length} 个拼批异常`));
      }
    }

    await this.writeResults(allCurves);
    await this.writeAnomalyReport();

    return {
      totalFiles: this.totalFiles,
      totalAnomalies: this.anomalies.length
    };
  }

  getCsvFiles(dir) {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.csv'))
      .map(f => path.join(dir, f));
  }

  async parseCsvFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      let lineNumber = 2;
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          results.push({ ...data, _line: lineNumber++ });
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  analyzeCurve(file, curveData) {
    const anomalies = [];
    const fileName = path.basename(file);

    const gapAnomalies = this.detectSensorGaps(fileName, curveData);
    anomalies.push(...gapAnomalies);

    const valueAnomalies = this.detectInvalidValues(fileName, curveData);
    anomalies.push(...valueAnomalies);

    return anomalies;
  }

  detectSensorGaps(fileName, curveData) {
    const anomalies = [];
    
    for (let i = 1; i < curveData.length; i++) {
      const prevTime = this.parseTime(curveData[i - 1].时间 || curveData[i - 1].time);
      const currTime = this.parseTime(curveData[i].时间 || curveData[i].time);
      
      if (prevTime !== null && currTime !== null) {
        const gap = (currTime - prevTime) / 1000;
        
        if (gap > this.sensorGapThreshold) {
          anomalies.push({
            type: '传感器断点',
            severity: '警告',
            file: fileName,
            line: curveData[i]._line,
            message: `时间间隔过大: ${gap.toFixed(1)}秒`,
            detail: `第${curveData[i - 1]._line}行到第${curveData[i]._line}行之间数据中断`
          });
        }
      }
    }

    return anomalies;
  }

  detectInvalidValues(fileName, curveData) {
    const anomalies = [];

    for (const row of curveData) {
      const beanTemp = parseFloat(row.豆温 || row.beanTemp);
      const envTemp = parseFloat(row.环境温 || row.envTemp);

      if (isNaN(beanTemp) || isNaN(envTemp)) {
        anomalies.push({
          type: '数据缺失',
          severity: '错误',
          file: fileName,
          line: row._line,
          message: '温度数据缺失或格式错误',
          detail: `豆温="${row.豆温 || row.beanTemp || ''}", 环境温="${row.环境温 || row.envTemp || ''}"`
        });
      } else if (beanTemp < 0 || beanTemp > 300) {
        anomalies.push({
          type: '温度异常',
          severity: '警告',
          file: fileName,
          line: row._line,
          message: '豆温超出正常范围',
          detail: `豆温=${beanTemp}°C (正常范围0-300°C)`
        });
      }
    }

    return anomalies;
  }

  detectBatchMerge(allCurves) {
    const anomalies = [];
    
    for (let i = 0; i < allCurves.length; i++) {
      for (let j = i + 1; j < allCurves.length; j++) {
        const curveA = allCurves[i];
        const curveB = allCurves[j];
        
        const similarity = this.calculateCurveSimilarity(curveA.data, curveB.data);
        
        if (similarity > 100 - this.batchThreshold) {
          anomalies.push({
            type: '拼批检测',
            severity: '警告',
            file: `${path.basename(curveA.file)} & ${path.basename(curveB.file)}`,
            line: '多文件',
            message: `两条曲线相似度高达 ${similarity.toFixed(1)}%`,
            detail: `可能是同一批次数据重复录入或拼批处理`
          });
        }
      }
    }

    return anomalies;
  }

  calculateCurveSimilarity(dataA, dataB) {
    if (dataA.length === 0 || dataB.length === 0) return 0;

    const minLen = Math.min(dataA.length, dataB.length);
    let totalDiff = 0;
    let validCount = 0;

    for (let i = 0; i < minLen; i++) {
      const tempA = parseFloat(dataA[i].豆温 || dataA[i].beanTemp);
      const tempB = parseFloat(dataB[i].豆温 || dataB[i].beanTemp);
      
      if (!isNaN(tempA) && !isNaN(tempB)) {
        totalDiff += Math.abs(tempA - tempB);
        validCount++;
      }
    }

    if (validCount === 0) return 0;

    const avgDiff = totalDiff / validCount;
    return Math.max(0, 100 - avgDiff);
  }

  parseTime(timeStr) {
    if (!timeStr) return null;
    
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const minutes = parseInt(parts[0]);
      const seconds = parseInt(parts[1]);
      return (minutes * 60 + seconds) * 1000;
    }
    
    const num = parseFloat(timeStr);
    if (!isNaN(num)) {
      return num * 1000;
    }
    
    return null;
  }

  async writeResults(allCurves) {
    const summaryPath = path.join(this.outputDir, '处理摘要.csv');
    const csvWriter = createCsvWriter({
      path: summaryPath,
      header: [
        { id: 'file', title: '文件名' },
        { id: 'dataPoints', title: '数据点数' },
        { id: 'startTemp', title: '起始豆温(°C)' },
        { id: 'endTemp', title: '结束豆温(°C)' },
        { id: 'anomalies', title: '异常数' },
        { id: 'status', title: '状态' }
      ]
    });

    const records = allCurves.map(curve => {
      const fileAnomalies = this.anomalies.filter(a => 
        a.file.includes(path.basename(curve.file))
      );
      
      const startTemp = curve.data.length > 0 ? 
        (parseFloat(curve.data[0].豆温 || curve.data[0].beanTemp) || 'N/A') : 'N/A';
      const endTemp = curve.data.length > 0 ?
        (parseFloat(curve.data[curve.data.length - 1].豆温 || curve.data[curve.data.length - 1].beanTemp) || 'N/A') : 'N/A';

      return {
        file: path.basename(curve.file),
        dataPoints: curve.data.length,
        startTemp,
        endTemp,
        anomalies: fileAnomalies.length,
        status: fileAnomalies.length > 0 ? '需修正' : '正常'
      };
    });

    await csvWriter.writeRecords(records);
  }

  async writeAnomalyReport() {
    const reportPath = path.join(this.outputDir, '异常报告.csv');
    const csvWriter = createCsvWriter({
      path: reportPath,
      header: [
        { id: 'type', title: '异常类型' },
        { id: 'severity', title: '严重程度' },
        { id: 'file', title: '来源文件' },
        { id: 'line', title: '行号' },
        { id: 'message', title: '异常信息' },
        { id: 'detail', title: '详细说明' }
      ]
    });

    await csvWriter.writeRecords(this.anomalies);
  }
}

module.exports = RoastingCurveCompare;
