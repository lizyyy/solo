export const OPERATORS = [
  { id: 'OP001', name: '张三', department: '技术部' },
  { id: 'OP002', name: '李四', department: '运维部' },
  { id: 'OP003', name: '王五', department: '安全部' },
  { id: 'OP004', name: '赵六', department: '测试部' },
  { id: 'OP005', name: '钱七', department: '产品部' }
];

export const RISK_TYPES = [
  { code: 'HIGH', name: '高风险', description: '核心业务系统，影响范围广' },
  { code: 'MEDIUM', name: '中风险', description: '重要业务系统，有替代方案' },
  { code: 'LOW', name: '低风险', description: '辅助系统，影响范围小' },
  { code: 'CRITICAL', name: '极高风险', description: '支付、用户核心数据' }
];

export const VERSIONS = [
  'v1.0.0', 'v1.1.0', 'v1.2.0', 'v2.0.0', 'v2.1.0',
  'v3.0.0', 'v3.1.0', 'v3.2.0', 'v4.0.0', 'v4.1.0'
];

export const SYSTEMS = [
  '用户中心', '支付系统', '订单系统', '库存系统', '物流系统',
  '消息推送', '报表系统', '风控系统', '缓存服务', '搜索服务'
];

export const STATUS_FLOW = [
  '待审批', '审批中', '已批准', '待执行', '执行中', '已完成', '已失败', '已撤回', '已催办'
];

export const FAILURE_REASONS = [
  '版本号冲突', '审批人不在岗', '系统正在维护', '网络连接超时',
  '数据库锁定', '权限不足', '依赖服务不可用', '配置项缺失',
  '旧版本覆盖新版本', '数据校验不通过'
];

export const APPROVERS = [
  { id: 'AP001', name: '王总监', level: 'L1' },
  { id: 'AP002', name: '李经理', level: 'L2' },
  { id: 'AP003', name: '张主管', level: 'L3' }
];

export function generateBatchId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return 'BATCH-' + dateStr + '-' + random;
}

export function generateRecordId() {
  return 'REC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

export function randomPick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
