const store = require('../store/dataStore');
const mergeService = require('../services/mergeService');

const demoIdentities = [
  { externalId: 'APP_001', source: 'app', name: '张三', email: 'zhangsan@example.com', phone: '13800138001' },
  { externalId: 'WEB_001', source: 'web', name: '张三', email: 'zhangsan@example.com', phone: '13800138001' },
  { externalId: 'CS_001', source: 'cs', name: '张先生', email: 'zhangsan@example.com', phone: '13800138001' },
  { externalId: 'APP_002', source: 'app', name: '李四', email: 'lisi@example.com', phone: '13800138002' },
  { externalId: 'WEB_002', source: 'web', name: '李四', email: 'lisi@example.com', phone: '13800138002' },
  { externalId: 'APP_003', source: 'app', name: '王五', email: 'wangwu@example.com', phone: '13800138003' },
  { externalId: 'CS_002', source: 'cs', name: '王经理', email: 'wangwu@company.com', phone: '13800138003' },
  { externalId: 'WEB_003', source: 'web', name: '赵六', email: 'zhaoliu@example.com', phone: '13800138004' },
  { externalId: 'APP_004', source: 'app', name: '钱七', email: 'qianqi@example.com', phone: '13800138005' },
  { externalId: 'CS_003', source: 'cs', name: '孙八', email: 'sunba@example.com', phone: '13800138006' },
  { externalId: 'WEB_004', source: 'web', name: '周九', email: 'zhoujiu@example.com', phone: '13800138007' },
  { externalId: 'APP_005', source: 'app', name: '吴十', email: 'wushi@example.com', phone: '13800138008' },
];

function initDemoData() {
  const existing = store.getExternalIdentities();
  if (existing.length > 0) {
    console.log('已有数据，跳过初始化');
    return;
  }

  console.log('正在初始化演示数据...');

  const createdIdentities = demoIdentities.map(id => {
    return store.addExternalIdentity(id);
  });

  const transaction1 = mergeService.initiateMerge(
    [createdIdentities[0].id, createdIdentities[1].id, createdIdentities[2].id],
    '三个渠道同一客户自动匹配合并',
    'system'
  );

  mergeService.approveMerge(transaction1.id, 'admin');
  mergeService.executeMerge(transaction1.id, 'admin', 'latest');

  const transaction2 = mergeService.initiateMerge(
    [createdIdentities[3].id, createdIdentities[4].id],
    'App和官网同一客户',
    'system'
  );
  mergeService.approveMerge(transaction2.id, 'admin');

  mergeService.initiateMerge(
    [createdIdentities[5].id, createdIdentities[6].id],
    '疑似同一客户待确认',
    'system'
  );

  console.log(`演示数据初始化完成！创建了 ${createdIdentities.length} 个身份，3 个合并事务`);
  console.log('访问 http://localhost:3000 查看控制台');
}

module.exports = { initDemoData };