const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { RedispatchRecord, RiderSettlement, RejectionReason } = require('./models');

class CsvHandler {
  static async readRedispatchRecords(filePath) {
    return this.readCsv(filePath, (row) => new RedispatchRecord(row));
  }

  static async readRiderSettlements(filePath) {
    return this.readCsv(filePath, (row) => new RiderSettlement(row));
  }

  static async readRejectionReasons(filePath) {
    return this.readCsv(filePath, (row) => new RejectionReason(row));
  }

  static async readCsv(filePath, mapper) {
    return new Promise((resolve, reject) => {
      const results = [];
      if (!fs.existsSync(filePath)) {
        reject(new Error(`文件不存在: ${filePath}`));
        return;
      }

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          try {
            results.push(mapper(data));
          } catch (error) {
            console.error(`解析行数据失败: ${JSON.stringify(data)}`, error);
          }
        })
        .on('end', () => resolve(results))
        .on('error', (error) => reject(new Error(`读取CSV文件失败: ${error.message}`)));
    });
  }

  static async writeCompensationResults(filePath, results, summary) {
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'orderId_Display', title: '订单显示编号' },
        { id: 'orderId', title: '订单编号' },
        { id: 'originalRiderId', title: '原骑手ID' },
        { id: 'originalRiderName', title: '原骑手姓名' },
        { id: 'newRiderId', title: '新骑手ID' },
        { id: 'newRiderName', title: '新骑手姓名' },
        { id: 'redispatchTime', title: '改派时间' },
        { id: 'redispatchType', title: '改派类型' },
        { id: 'redispatchReason', title: '改派原因' },
        { id: 'calculatedCompensation', title: '核算补偿金额' },
        { id: 'previousCompensation', title: '历史已补偿金额' },
        { id: 'finalCompensation', title: '本次实际补偿金额' },
        { id: 'compensationStatus', title: '补偿状态' },
        { id: 'compensationRemark', title: '补偿备注' },
        { id: 'isDuplicate', title: '是否重复记录' },
        { id: 'isError', title: '是否核算错误' },
        { id: 'errorMessage', title: '错误信息' }
      ],
      encoding: 'utf8'
    });

    const records = results.map(r => ({
      ...r,
      isDuplicate: r.isDuplicate ? '是' : '否',
      isError: r.isError ? '是' : '否'
    }));

    await csvWriter.writeRecords(records);

    const summaryLine = `\n\n核算汇总,,,\n总记录数,${summary.totalRecords},,\n核算成功,${summary.totalRecords - summary.errorRecords},,\n核算失败,${summary.errorRecords},,\n重复记录,${summary.duplicateRecords},,\n实际补偿,${summary.compensatedRecords},,\n跳过补偿,${summary.skippedRecords},,\n补偿总金额,${summary.totalCompensation.toFixed(2)}元,,`;

    fs.appendFileSync(filePath, summaryLine, 'utf8');
  }

  static async writeErrorLog(filePath, errors) {
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'recordIndex', title: '记录行号' },
        { id: 'orderId', title: '订单编号' },
        { id: 'error', title: '错误详情' }
      ],
      encoding: 'utf8'
    });

    await csvWriter.writeRecords(errors);
  }
}

module.exports = CsvHandler;
