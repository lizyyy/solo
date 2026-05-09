const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const sampleDataDir = path.join(__dirname, '../sample-data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('已创建 data 目录');
}

if (!fs.existsSync(sampleDataDir)) {
  fs.mkdirSync(sampleDataDir, { recursive: true });
  console.log('已创建 sample-data 目录');
}

const sampleActivityData = {
  storeId: 'STORE-001',
  storeName: '阳光食品店',
  activityName: '五一新品试吃活动',
  activityDate: '2026-05-01',
  productName: '抹茶口味曲奇饼干',
  description: '五一劳动节期间在门店举办的新品试吃推广活动'
};

const sampleBatchData = {
  batchNumber: 'BATCH-2026-0425-001',
  productionDate: '2026-04-25',
  expirationDate: '2026-06-25',
  quantity: 500
};

const sampleArchiveData = {
  activityId: 'AUTO-FILL',
  batchId: 'AUTO-FILL',
  sampleQuantity: 2,
  storageLocation: '门店冷藏柜 A-03',
  archiveDate: '2026-05-01',
  shelfLifeDays: 7
};

const sampleComplaintData = {
  activityId: 'AUTO-FILL',
  sampleArchiveId: 'AUTO-FILL',
  complaintType: '食品安全',
  complaintDate: '2026-05-05',
  complaintContent: '消费者反馈食用试吃饼干后出现腹痛腹泻症状，怀疑食品存在质量问题',
  complainant: '李女士',
  contactInfo: '138****5678'
};

const sampleReportData = {
  reportContent: '已调取相关批次留样进行检验，生产日期2026-04-25，批次号BATCH-2026-0425-001。留样存储条件符合要求，留样数量2份，位置门店冷藏柜A-03。',
  reportDate: '2026-05-05'
};

fs.writeFileSync(
  path.join(sampleDataDir, 'sample-activity.json'),
  JSON.stringify(sampleActivityData, null, 2)
);

fs.writeFileSync(
  path.join(sampleDataDir, 'sample-batch.json'),
  JSON.stringify(sampleBatchData, null, 2)
);

fs.writeFileSync(
  path.join(sampleDataDir, 'sample-archive.json'),
  JSON.stringify(sampleArchiveData, null, 2)
);

fs.writeFileSync(
  path.join(sampleDataDir, 'sample-complaint.json'),
  JSON.stringify(sampleComplaintData, null, 2)
);

fs.writeFileSync(
  path.join(sampleDataDir, 'sample-report.json'),
  JSON.stringify(sampleReportData, null, 2)
);

console.log('\n✅ 样例数据文件已创建:');
console.log('   - sample-data/sample-activity.json');
console.log('   - sample-data/sample-batch.json');
console.log('   - sample-data/sample-archive.json');
console.log('   - sample-data/sample-complaint.json');
console.log('   - sample-data/sample-report.json');

console.log('\n📁 目录结构:');
console.log('   data/              - SQLite数据库文件目录');
console.log('   sample-data/       - 样例数据JSON文件');
