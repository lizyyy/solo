const store = require('../src/store/memoryStore');
const rotationService = require('../src/services/RotationService');

console.log('开始初始化示例数据...\n');

const sampleServices = [
  { serviceName: 'user-auth-service', currentOwner: 'zhang.san', candidateOwner: 'li.si' },
  { serviceName: 'order-payment-service', currentOwner: 'wang.wu', candidateOwner: 'zhao.liu' },
  { serviceName: 'notification-gateway', currentOwner: 'qian.qi', candidateOwner: 'sun.ba' }
];

const sampleRotations = [
  {
    serviceName: 'user-auth-service',
    currentOwner: 'zhang.san',
    candidateOwner: 'li.si',
    reason: '轮岗换岗',
    alertReferences: ['ALERT-2024-001', 'ALERT-2024-002']
  },
  {
    serviceName: 'order-payment-service',
    currentOwner: 'wang.wu',
    candidateOwner: 'zhao.liu',
    reason: '离职交接',
    alertReferences: ['ALERT-2024-003']
  }
];

try {
  for (const service of sampleServices) {
    store.createService(service);
    console.log(`✅ 服务已创建: ${service.serviceName}`);
  }

  console.log('');

  for (const rot of sampleRotations) {
    const rotation = rotationService.createRotation(
      rot.serviceName,
      rot.currentOwner,
      rot.candidateOwner,
      rot.reason,
      rot.alertReferences,
      'system'
    );
    console.log(`✅ 轮转已创建: ${rot.serviceName} (ID: ${rotation.id.substring(0, 8)}...)`);
  }

  const rotations = store.listRotations();
  if (rotations.length > 0) {
    const firstRotationId = rotations[0].id;
    
    rotationService.startConfirm(firstRotationId, 'system');
    console.log(`\n✅ 轮转已启动确认流程: ${firstRotationId.substring(0, 8)}...`);

    rotationService.confirmReceipt(firstRotationId, rotations[0].candidateOwner, '已接收告警配置，熟悉服务文档');
    console.log(`✅ 候选负责人已确认回执`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('示例数据初始化完成！');
  console.log(`服务数量: ${sampleServices.length}`);
  console.log(`轮转数量: ${sampleRotations.length}`);
  console.log('═══════════════════════════════════════════════════\n');

} catch (error) {
  console.error('❌ 初始化失败:', error.message);
  process.exit(1);
}
