const fs = require('fs');
const csv = require('csv-parser');

async function readCSV(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

async function readPreOccupation(filePath) {
  const data = await readCSV(filePath);
  return data.map(row => ({
    preOccupationId: row.预占单号 || row.preOccupationId,
    skuCode: row.SKU编码 || row.skuCode,
    skuName: row.SKU名称 || row.skuName,
    quantity: parseInt(row.预占数量 || row.quantity, 10),
    createTime: row.预占时间 || row.createTime,
    expireTime: row.过期时间 || row.expireTime,
    status: row.预占状态 || row.status,
    orderSource: row.订单来源 || row.orderSource,
    operator: row.操作人 || row.operator,
    remark: row.备注 || row.remark
  }));
}

async function readPaymentFlow(filePath) {
  const data = await readCSV(filePath);
  return data.map(row => ({
    paymentId: row.支付流水号 || row.paymentId,
    preOccupationId: row.关联预占单号 || row.preOccupationId,
    paymentTime: row.支付时间 || row.paymentTime,
    amount: parseFloat(row.支付金额 || row.amount),
    status: row.支付状态 || row.status,
    paymentMethod: row.支付方式 || row.paymentMethod,
    failReason: row.失败原因 || row.failReason
  }));
}

async function readInventory(filePath) {
  const data = await readCSV(filePath);
  return data.map(row => ({
    skuCode: row.SKU编码 || row.skuCode,
    skuName: row.SKU名称 || row.skuName,
    totalInventory: parseInt(row.总库存 || row.totalInventory, 10),
    occupiedInventory: parseInt(row.已预占库存 || row.occupiedInventory, 10),
    availableInventory: parseInt(row.可用库存 || row.availableInventory, 10),
    warehouse: row.仓库 || row.warehouse,
    snapshotTime: row.快照时间 || row.snapshotTime
  }));
}

module.exports = {
  readPreOccupation,
  readPaymentFlow,
  readInventory
};
