const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

async function generateReports(result, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = [];

  files.push(await generateUnreleasedDetail(result.unreleasedList, outputDir));
  files.push(await generatePaymentFailedDetail(result.paymentFailedList, outputDir));
  files.push(await generateTimeoutDetail(result.timeoutList, outputDir));
  files.push(await generateManualExchangeDetail(result.manualExchangeList, outputDir));
  files.push(await generateNormalReleasedDetail(result.normalReleasedList, outputDir));
  files.push(await generateInventoryVerification(result.inventoryVerification, outputDir));
  files.push(await generateSummaryReport(result.summary, files, outputDir));

  return files;
}

async function generateUnreleasedDetail(data, outputDir) {
  const filePath = path.join(outputDir, '01-未释放预占库存明细表.csv');
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'preOccupationId', title: '预占单号' },
      { id: 'skuCode', title: 'SKU编码' },
      { id: 'skuName', title: 'SKU名称' },
      { id: 'quantity', title: '预占数量' },
      { id: 'createTime', title: '预占时间' },
      { id: 'expireTime', title: '过期时间' },
      { id: 'preOccupationStatus', title: '预占状态' },
      { id: 'paymentStatus', title: '支付状态' },
      { id: 'reconciliationType', title: '对账类型' },
      { id: 'reconciliationStatus', title: '对账状态' },
      { id: 'reconciliationRemark', title: '对账备注' },
      { id: 'orderSource', title: '订单来源' },
      { id: 'operator', title: '操作人' },
      { id: 'remark', title: '原始备注' }
    ]
  });
  await csvWriter.writeRecords(data);
  return {
    fileName: '01-未释放预占库存明细表.csv',
    description: '所有未释放预占库存的汇总明细，包含支付失败、超时取消、手工兑换等全部异常类型',
    recordCount: data.length
  };
}

async function generatePaymentFailedDetail(data, outputDir) {
  const filePath = path.join(outputDir, '02-支付失败预占明细表.csv');
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'preOccupationId', title: '预占单号' },
      { id: 'skuCode', title: 'SKU编码' },
      { id: 'skuName', title: 'SKU名称' },
      { id: 'quantity', title: '预占数量' },
      { id: 'createTime', title: '预占时间' },
      { id: 'paymentTime', title: '支付时间' },
      { id: 'paymentMethod', title: '支付方式' },
      { id: 'paymentStatus', title: '支付状态' },
      { id: 'failReason', title: '支付失败原因' },
      { id: 'reconciliationStatus', title: '对账状态' },
      { id: 'reconciliationRemark', title: '对账备注' }
    ]
  });
  await csvWriter.writeRecords(data);
  return {
    fileName: '02-支付失败预占明细表.csv',
    description: '因支付失败导致的未释放预占库存明细，需重点跟进确认是否人工释放',
    recordCount: data.length
  };
}

async function generateTimeoutDetail(data, outputDir) {
  const filePath = path.join(outputDir, '03-超时取消预占明细表.csv');
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'preOccupationId', title: '预占单号' },
      { id: 'skuCode', title: 'SKU编码' },
      { id: 'skuName', title: 'SKU名称' },
      { id: 'quantity', title: '预占数量' },
      { id: 'createTime', title: '预占时间' },
      { id: 'expireTime', title: '过期时间' },
      { id: 'preOccupationStatus', title: '预占状态' },
      { id: 'reconciliationStatus', title: '对账状态' },
      { id: 'reconciliationRemark', title: '对账备注' }
    ]
  });
  await csvWriter.writeRecords(data);
  return {
    fileName: '03-超时取消预占明细表.csv',
    description: '已超过预占有效期但系统未自动释放的预占库存明细，需检查自动释放机制是否正常',
    recordCount: data.length
  };
}

async function generateManualExchangeDetail(data, outputDir) {
  const filePath = path.join(outputDir, '04-手工兑换预占明细表.csv');
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'preOccupationId', title: '预占单号' },
      { id: 'skuCode', title: 'SKU编码' },
      { id: 'skuName', title: 'SKU名称' },
      { id: 'quantity', title: '预占数量' },
      { id: 'createTime', title: '预占时间' },
      { id: 'orderSource', title: '订单来源' },
      { id: 'operator', title: '操作人' },
      { id: 'remark', title: '兑换备注' },
      { id: 'reconciliationStatus', title: '对账状态' },
      { id: 'reconciliationRemark', title: '对账备注' }
    ]
  });
  await csvWriter.writeRecords(data);
  return {
    fileName: '04-手工兑换预占明细表.csv',
    description: '手工/线下兑换产生的预占库存，需人工复核确认是否已实际出库并释放库存',
    recordCount: data.length
  };
}

async function generateNormalReleasedDetail(data, outputDir) {
  const filePath = path.join(outputDir, '05-正常释放预占明细表.csv');
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'preOccupationId', title: '预占单号' },
      { id: 'skuCode', title: 'SKU编码' },
      { id: 'skuName', title: 'SKU名称' },
      { id: 'quantity', title: '预占数量' },
      { id: 'createTime', title: '预占时间' },
      { id: 'preOccupationStatus', title: '预占状态' },
      { id: 'paymentStatus', title: '支付状态' },
      { id: 'reconciliationStatus', title: '对账状态' },
      { id: 'reconciliationRemark', title: '对账备注' }
    ]
  });
  await csvWriter.writeRecords(data);
  return {
    fileName: '05-正常释放预占明细表.csv',
    description: '已正常释放的预占库存明细，作为对账基准数据',
    recordCount: data.length
  };
}

async function generateInventoryVerification(data, outputDir) {
  const filePath = path.join(outputDir, '06-库存验证对照表.csv');
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'skuCode', title: 'SKU编码' },
      { id: 'skuName', title: 'SKU名称' },
      { id: 'unreleasedQuantity', title: '对账未释放数量' },
      { id: 'systemOccupiedInventory', title: '系统预占库存' },
      { id: 'inventoryDiff', title: '库存差异' },
      { id: 'verificationStatus', title: '验证状态' },
      { id: 'verificationRemark', title: '验证备注' }
    ]
  });
  await csvWriter.writeRecords(data);
  return {
    fileName: '06-库存验证对照表.csv',
    description: '对账结果与库存快照的对比验证，用于发现库存数据不一致问题',
    recordCount: data.length
  };
}

async function generateSummaryReport(summary, files, outputDir) {
  const filePath = path.join(outputDir, '00-商城库存快照预占释放对账汇总报告.txt');
  
  let content = `
================================================================================
                      商城库存快照预占释放对账汇总报告
================================================================================

对账时间：${new Date(summary.reconciliationTime).toLocaleString('zh-CN')}

一、对账数据概览
--------------------------------------------------------------------------------
  预占单总数：${summary.totalPreOccupations} 条
  支付流水数：${summary.totalPayments} 条
  库存SKU数：${summary.totalSKUs} 个

二、对账结果统计
--------------------------------------------------------------------------------
  未释放预占总数：${summary.totalUnreleased} 条
    ├─ 支付失败：${summary.paymentFailedCount} 条
    ├─ 超时取消：${summary.timeoutCount} 条
    ├─ 手工兑换：${summary.manualExchangeCount} 条
    └─ 其他待核查：${summary.totalUnreleased - summary.paymentFailedCount - summary.timeoutCount - summary.manualExchangeCount} 条
  
  正常释放预占：${summary.normalReleasedCount} 条

三、生成文件说明
--------------------------------------------------------------------------------
`;

  files.forEach((file, index) => {
    content += `
  ${String(index + 1).padStart(2, '0')}. ${file.fileName}
     描述：${file.description}
     记录数：${file.recordCount} 条
`;
  });

  content += `
================================================================================
                            报告生成完成
================================================================================
`;

  fs.writeFileSync(filePath, content, 'utf8');
  
  return {
    fileName: '00-商城库存快照预占释放对账汇总报告.txt',
    description: '对账结果总览、统计数据和所有生成文件的说明文档',
    recordCount: 1
  };
}

module.exports = {
  generateReports
};
