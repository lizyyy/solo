import * as fs from 'fs';
import * as path from 'path';
import app from './app';
import dataStore from './models/DataStore';
import { MemberLevel, Batch, ProcessingRecord, Member, ActivityRule, OperationLog, Receipt } from './types';

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveDataToFile(): boolean {
  try {
    ensureDataDir();
    const data = {
      batches: Array.from((dataStore as any)['batches'].values()),
      processingRecords: Array.from((dataStore as any)['processingRecords'].values()),
      members: Array.from((dataStore as any)['members'].values()),
      activityRules: Array.from((dataStore as any)['activityRules'].values()),
      operationLogs: Array.from((dataStore as any)['operationLogs'].values()),
      receipts: Array.from((dataStore as any)['receipts'].values()),
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('💾 数据已持久化到 ' + DATA_FILE);
    return true;
  } catch (error) {
    console.error('❌ 数据持久化失败:', error);
    return false;
  }
}

function loadDataFromFile(): boolean {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return false;
    }
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(rawData);

    data.batches?.forEach((batch: Batch) => {
      batch.createdAt = new Date(batch.createdAt);
      batch.updatedAt = new Date(batch.updatedAt);
      (dataStore as any)['batches'].set(batch.id, batch);
    });

    data.processingRecords?.forEach((record: ProcessingRecord) => {
      record.transactionTime = new Date(record.transactionTime);
      record.createdAt = new Date(record.createdAt);
      record.updatedAt = new Date(record.updatedAt);
      record.auditTrail.forEach(trail => {
        trail.timestamp = new Date(trail.timestamp);
      });
      (dataStore as any)['processingRecords'].set(record.id, record);
    });

    data.members?.forEach((member: Member) => {
      member.registerTime = new Date(member.registerTime);
      if (member.lastConsumeTime) {
        member.lastConsumeTime = new Date(member.lastConsumeTime);
      }
      (dataStore as any)['members'].set(member.id, member);
    });

    data.activityRules?.forEach((rule: ActivityRule) => {
      rule.startTime = new Date(rule.startTime);
      rule.endTime = new Date(rule.endTime);
      (dataStore as any)['activityRules'].set(rule.id, rule);
    });

    data.operationLogs?.forEach((log: OperationLog) => {
      log.createdAt = new Date(log.createdAt);
      (dataStore as any)['operationLogs'].set(log.id, log);
    });

    data.receipts?.forEach((receipt: Receipt) => {
      receipt.transactionTime = new Date(receipt.transactionTime);
      (dataStore as any)['receipts'].set(receipt.id, receipt);
    });

    console.log('📂 数据已从 ' + DATA_FILE + ' 恢复');
    return true;
  } catch (error) {
    console.error('❌ 数据加载失败:', error);
    return false;
  }
}

function initSampleData() {
  const hasData = Array.from((dataStore as any)['activityRules'].values()).length > 0;
  if (hasData) {
    console.log('✅ 已有数据，跳过示例数据初始化');
    return;
  }

  dataStore.saveActivityRule({
    id: dataStore.generateId(),
    activityCode: 'PROMO_2024_001',
    activityName: '五一黄金周双倍积分活动',
    startTime: new Date('2024-05-01'),
    endTime: new Date('2024-05-07'),
    applicableStores: ['STORE001', 'STORE002', 'STORE003'],
    applicableLevels: [MemberLevel.SILVER, MemberLevel.GOLD, MemberLevel.PLATINUM],
    minAmount: 100,
    pointMultiplier: 2,
    maxPointsPerReceipt: 5000,
    description: '五一期间会员消费享双倍积分，单票最高5000积分'
  });

  dataStore.saveActivityRule({
    id: dataStore.generateId(),
    activityCode: 'PROMO_2024_002',
    activityName: '新店开业三倍积分',
    startTime: new Date('2024-06-01'),
    endTime: new Date('2024-06-30'),
    applicableStores: ['STORE004'],
    applicableLevels: [MemberLevel.NORMAL, MemberLevel.SILVER, MemberLevel.GOLD, MemberLevel.PLATINUM],
    minAmount: 50,
    pointMultiplier: 3,
    maxPointsPerReceipt: 10000,
    description: '新店开业期间所有会员三倍积分'
  });

  console.log('✅ 示例活动规则已初始化');
  saveDataToFile();
}

app.listen(PORT, () => {
  console.log('');
  console.log('=====================================');
  console.log('🚀 连锁门店运营后端服务已启动');
  console.log('=====================================');
  console.log('📍 服务地址: http://localhost:' + PORT);
  console.log('📊 健康检查: http://localhost:' + PORT + '/health');
  console.log('📚 API文档: 请参考 README');
  console.log('💾 数据文件: ' + DATA_FILE);
  console.log('');
  
  const loaded = loadDataFromFile();
  if (!loaded) {
    initSampleData();
  }
  
  setInterval(() => {
    saveDataToFile();
  }, 30000);
  
  console.log('⏰ 自动持久化: 每30秒保存一次');
  console.log('');
});
