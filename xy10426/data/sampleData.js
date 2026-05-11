const models = require('./models');

function initSampleData() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  const change1 = models.createChange({
    title: '核心交换机网络割接',
    description: '将核心交换机SW-01的上行链路从GE口迁移到10GE口，提升带宽。',
    type: 'network',
    assetIds: ['a1', 'a9'],
    windowStart: tomorrow.setHours(2, 0, 0, 0),
    windowEnd: tomorrow.setHours(4, 0, 0, 0),
    risk: 'high',
    rollbackPlan: '1. 断开新的10GE链路；2. 重新连接原GE链路；3. 验证路由恢复；4. 确认业务正常。',
    ownerId: 'u1'
  });
  
  const change2 = models.createChange({
    title: 'MySQL数据库版本升级',
    description: '将MySQL主从库从5.7升级到8.0，采用滚动升级方式。',
    type: 'database',
    assetIds: ['a7', 'a8', 'a4'],
    windowStart: dayAfter.setHours(22, 0, 0, 0),
    windowEnd: dayAfter.setHours(24, 0, 0, 0),
    risk: 'high',
    rollbackPlan: '1. 停止新主库写入；2. 切换回旧主库；3. 重建旧从库；4. 验证数据一致性。',
    ownerId: 'u2'
  });
  
  const change3 = models.createChange({
    title: '应用服务器迁移',
    description: '将APP-01和APP-02从C区机房迁移到E区机房，采用虚拟机热迁移。',
    type: 'server',
    assetIds: ['a5', 'a6'],
    windowStart: threeDaysLater.setHours(1, 0, 0, 0),
    windowEnd: threeDaysLater.setHours(3, 0, 0, 0),
    risk: 'medium',
    rollbackPlan: '1. 停止新服务器服务；2. 切换回原机房服务器；3. 验证服务恢复；4. 回滚DNS配置。',
    ownerId: 'u1'
  });
  
  const change4 = models.createChange({
    title: '接入交换机配置更新',
    description: '更新接入交换机SW-03的VLAN配置，添加新的业务VLAN。',
    type: 'network',
    assetIds: ['a3'],
    windowStart: yesterday.setHours(23, 0, 0, 0),
    windowEnd: yesterday.setHours(23, 30, 0, 0),
    risk: 'low',
    rollbackPlan: '1. 保存当前配置；2. 如需回退，恢复保存的配置文件。',
    ownerId: 'u2'
  });
  
  models.addApproval(change4.id, 'u3', 'approve', '风险较低，同意执行。');
  models.startExecution(change4.id, 'u2');
  models.addExecutionLog(change4.id, 'u2', 'configure', '正在更新VLAN配置...');
  models.addExecutionLog(change4.id, 'u2', 'verify', '验证VLAN配置生效');
  models.completeChange(change4.id, 'u2', '配置更新完成，业务VLAN 100-105已成功添加，验证通过。');
  
  const change5 = models.createChange({
    title: '防火墙规则更新',
    description: '更新防火墙FW-01的访问控制规则，开放新的业务端口。',
    type: 'security',
    assetIds: ['a10'],
    windowStart: twoDaysAgo.setHours(22, 0, 0, 0),
    windowEnd: twoDaysAgo.setHours(22, 30, 0, 0),
    risk: 'medium',
    rollbackPlan: '1. 导出当前规则集；2. 如需回退，导入之前的规则集。',
    ownerId: 'u2'
  });
  
  models.addApproval(change5.id, 'u4', 'approve', '规则变更已审核，同意执行。');
  models.startExecution(change5.id, 'u2');
  models.addExecutionLog(change5.id, 'u2', 'configure', '正在添加新的防火墙规则...');
  models.addExecutionLog(change5.id, 'u2', 'verify', '发现新规则导致部分业务访问异常');
  models.rollbackChange(change5.id, 'u2', '新规则导致业务访问异常', '已回滚到上一版规则集，业务访问恢复正常。需要重新评估规则配置。');
  
  models.addApproval(change1.id, 'u3', 'approve', '割接方案可行，注意监控链路状态。');
  
  console.log('样例数据初始化完成');
}

module.exports = { initSampleData };
