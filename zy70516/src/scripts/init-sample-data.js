const { runQuery, initDatabase } = require('../database');

const sampleData = [
  {
    service_name: '订单服务',
    window_start: '2026-05-20T00:00:00Z',
    window_end: '2026-05-20T02:00:00Z',
    risk_level: 'high',
    dependent_services: '支付服务, 用户服务',
    status: 'approved',
    created_by: '张三',
    approver: '李四',
    conclusion: '已审批通过，请按计划执行'
  },
  {
    service_name: '用户服务',
    window_start: '2026-05-20T02:00:00Z',
    window_end: '2026-05-20T04:00:00Z',
    risk_level: 'medium',
    dependent_services: '',
    status: 'pending',
    created_by: '王五',
    approver: null,
    conclusion: null
  },
  {
    service_name: '支付服务',
    window_start: '2026-05-21T00:00:00Z',
    window_end: '2026-05-21T03:00:00Z',
    risk_level: 'critical',
    dependent_services: '银行网关服务',
    status: 'confirmed',
    created_by: '赵六',
    approver: '王经理',
    conclusion: '关键变更，需要运维全程值守'
  },
  {
    service_name: '商品服务',
    window_start: '2026-05-22T00:00:00Z',
    window_end: '2026-05-22T01:00:00Z',
    risk_level: 'low',
    dependent_services: '',
    status: 'delayed',
    created_by: '孙七',
    approver: '周八',
    conclusion: '依赖问题延期，待解决后重新申请'
  },
  {
    service_name: '搜索服务',
    window_start: '2026-05-23T00:00:00Z',
    window_end: '2026-05-23T06:00:00Z',
    risk_level: 'low',
    dependent_services: '',
    status: 'completed',
    created_by: '吴九',
    approver: '郑十',
    conclusion: '变更已顺利完成'
  }
];

const initSampleData = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    console.log('开始插入样例数据...');
    
    for (const data of sampleData) {
      await runQuery(`
        INSERT INTO appointments (service_name, window_start, window_end, risk_level, dependent_services, status, created_by, approver, conclusion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.service_name,
        data.window_start,
        data.window_end,
        data.risk_level,
        data.dependent_services,
        data.status,
        data.created_by,
        data.approver,
        data.conclusion
      ]);
      console.log(`已插入: ${data.service_name}`);
    }
    
    console.log('');
    console.log('========================================');
    console.log('样例数据初始化完成!');
    console.log('共插入 5 条预约记录');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
};

initSampleData();
