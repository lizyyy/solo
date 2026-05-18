const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { validateRow, detectSpecialCases, calculateUsage } = require('./utils');

async function processUtilitiesData(inputFile, outputDir, isRerun = false) {
  const records = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(inputFile, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (row) => {
        records.push(row);
      })
      .on('end', async () => {
        try {
          const result = await processRecords(records, outputDir, isRerun);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        reject(new Error(`读取CSV文件失败: ${error.message}`));
      });
  });
}

async function processRecords(records, outputDir, isRerun) {
  const normalRecords = [];
  const abnormalRecords = [];
  const meterChangeRecords = [];
  const extendStayRecords = [];
  const readingInversionRecords = [];
  const rerunnableRecords = [];
  const formatErrorRecords = [];

  const stats = {
    total: records.length,
    normal: 0,
    abnormal: 0
  };

  const categories = {
    meterChange: 0,
    extendStay: 0,
    readingInversion: 0,
    rerunnable: 0,
    formatError: 0
  };

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2;
    
    const validation = validateRow(row, rowNum);
    
    if (!validation.isValid) {
      categories.formatError++;
      formatErrorRecords.push({
        ...row,
        行号: rowNum,
        错误详情: validation.errors.join('; ')
      });
      continue;
    }

    const specialCases = detectSpecialCases(row);
    const usage = calculateUsage(row);
    const processedRow = {
      ...row,
      水用量: usage.水用量,
      电用量: usage.电用量,
      水费: usage.水费.toFixed(2),
      电费: usage.电费.toFixed(2),
      总费用: (usage.水费 + usage.电费).toFixed(2),
      特殊情况: specialCases.join(',') || '无',
      处理状态: specialCases.length > 0 ? '需复核' : '正常',
      重跑标记: isRerun ? '是' : '否'
    };

    let isAbnormal = false;

    if (specialCases.includes('换表')) {
      categories.meterChange++;
      meterChangeRecords.push(processedRow);
      isAbnormal = true;
    }

    if (specialCases.includes('续住')) {
      categories.extendStay++;
      extendStayRecords.push(processedRow);
      isAbnormal = true;
    }

    if (specialCases.includes('读数倒挂')) {
      categories.readingInversion++;
      readingInversionRecords.push(processedRow);
      isAbnormal = true;
    }

    if (specialCases.includes('可复跑') || (isRerun && specialCases.length > 0)) {
      categories.rerunnable++;
      rerunnableRecords.push(processedRow);
      isAbnormal = true;
    }

    if (isAbnormal) {
      stats.abnormal++;
      abnormalRecords.push(processedRow);
    } else {
      stats.normal++;
      normalRecords.push(processedRow);
    }
  }

  await writeOutputFiles(outputDir, {
    normalRecords,
    abnormalRecords,
    meterChangeRecords,
    extendStayRecords,
    readingInversionRecords,
    rerunnableRecords,
    formatErrorRecords
  });

  return { stats, categories };
}

async function writeOutputFiles(outputDir, data) {
  const commonFields = [
    { id: '公寓编号', title: '公寓编号' },
    { id: '房间号', title: '房间号' },
    { id: '租客姓名', title: '租客姓名' },
    { id: '入住日期', title: '入住日期' },
    { id: '退房日期', title: '退房日期' },
    { id: '水表起数', title: '水表起数' },
    { id: '水表止数', title: '水表止数' },
    { id: '电表起数', title: '电表起数' },
    { id: '电表止数', title: '电表止数' },
    { id: '水用量', title: '水用量(吨)' },
    { id: '电用量', title: '电用量(度)' },
    { id: '水费', title: '水费(元)' },
    { id: '电费', title: '电费(元)' },
    { id: '总费用', title: '总费用(元)' },
    { id: '特殊情况', title: '特殊情况' },
    { id: '处理状态', title: '处理状态' },
    { id: '重跑标记', title: '重跑标记' },
    { id: '备注', title: '备注' }
  ];

  const fileWriters = [
    {
      path: path.join(outputDir, '正常结果.csv'),
      records: data.normalRecords,
      fields: commonFields
    },
    {
      path: path.join(outputDir, '异常结果_汇总.csv'),
      records: data.abnormalRecords,
      fields: commonFields
    },
    {
      path: path.join(outputDir, '异常结果_换表.csv'),
      records: data.meterChangeRecords,
      fields: commonFields
    },
    {
      path: path.join(outputDir, '异常结果_续住.csv'),
      records: data.extendStayRecords,
      fields: commonFields
    },
    {
      path: path.join(outputDir, '异常结果_读数倒挂.csv'),
      records: data.readingInversionRecords,
      fields: commonFields
    },
    {
      path: path.join(outputDir, '异常结果_可复跑.csv'),
      records: data.rerunnableRecords,
      fields: commonFields
    },
    {
      path: path.join(outputDir, '格式错误.csv'),
      records: data.formatErrorRecords,
      fields: [
        { id: '行号', title: '行号' },
        { id: '错误详情', title: '错误详情' },
        ...commonFields.filter(f => f.id !== '水用量' && f.id !== '电用量' && f.id !== '水费' && f.id !== '电费' && f.id !== '总费用' && f.id !== '特殊情况' && f.id !== '处理状态' && f.id !== '重跑标记')
      ]
    }
  ];

  for (const writer of fileWriters) {
    if (writer.records.length > 0 || writer.path.includes('正常') || writer.path.includes('异常结果_汇总')) {
      const csvWriter = createCsvWriter({
        path: writer.path,
        header: writer.fields
      });
      await csvWriter.writeRecords(writer.records);
    }
  }
}

module.exports = {
  processUtilitiesData
};
