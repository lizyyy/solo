import app from './app';
import dataStore from './models/DataStore';
import { MemberLevel } from './types';

const PORT = process.env.PORT || 3000;

function initSampleData() {
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
}

app.listen(PORT, () => {
  console.log(`🚀 连锁门店运营服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
  console.log(`📚 API文档: http://localhost:${PORT}/api`);
  initSampleData();
});
