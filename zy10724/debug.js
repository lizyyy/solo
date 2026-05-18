const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

async function readCsv(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function debug() {
  const inventory = await readCsv('test-data/inventory.csv');
  console.log('库存记录:');
  console.log(JSON.stringify(inventory, null, 2));
  
  const returnOrders = await readCsv('test-data/return-orders.csv');
  console.log('\n返厂单:');
  console.log(JSON.stringify(returnOrders, null, 2));
  
  const inspectionResults = await readCsv('test-data/inspection-results.csv');
  console.log('\n检测结果:');
  console.log(JSON.stringify(inspectionResults, null, 2));
  
  const inventoryMap = new Map(
    inventory.map((item) => [item['备件编码'], item])
  );
  console.log('\nInventory Map keys:');
  console.log(Array.from(inventoryMap.keys()));
  
  console.log('\n检查 SP-001 是否存在:');
  console.log(inventoryMap.get('SP-001'));
  console.log(inventoryMap.get('SP-001')?.status);
  console.log(inventoryMap.get('SP-001')?.['状态']);
}

debug().catch(console.error);
