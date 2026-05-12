import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, allQuery } from './db';

export function initSampleData(): void {
  const existingBatches = getQuery<{ count: number }>('SELECT COUNT(*) as count FROM batches');
  if (existingBatches && existingBatches.count > 0) {
    return;
  }

  const now = new Date().toISOString();
  const batchId = uuidv4();

  runQuery(`
    INSERT INTO batches (id, name, description, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    batchId,
    '演示批次-2026-05-12',
    '内置样例数据，包含三种典型场景：完全通过、权限缺失、回调未切换',
    'in_progress',
    now,
    now
  ]);

  const tenant1Id = uuidv4();
  const tenant2Id = uuidv4();
  const tenant3Id = uuidv4();

  const tenants = [
    { id: tenant1Id, tenantId: 'T001', name: '科技公司A', status: 'passed' },
    { id: tenant2Id, tenantId: 'T002', name: '零售企业B', status: 'failed' },
    { id: tenant3Id, tenantId: 'T003', name: '金融机构C', status: 'in_progress' }
  ];

  for (const tenant of tenants) {
    runQuery(`
      INSERT INTO tenants (id, batch_id, tenant_id, tenant_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [tenant.id, batchId, tenant.tenantId, tenant.name, tenant.status, now, now]);
  }

  const tenant1OldSnapshot = {
    dataCount: 15234,
    permissions: ['read', 'write', 'admin', 'report'],
    tasks: [
      { name: '日终结算', type: 'scheduled', cron: '0 22 * * *' },
      { name: '数据同步', type: 'realtime' },
      { name: '账单生成', type: 'scheduled', cron: '0 0 * * 1' }
    ],
    callbacks: [
      { service: '支付服务', url: 'http://old-cluster.example.com/api/payments/callback' },
      { service: '订单服务', url: 'http://old-cluster.example.com/api/orders/callback' }
    ]
  };

  const tenant1NewSnapshot = {
    dataCount: 15234,
    permissions: ['read', 'write', 'admin', 'report'],
    tasks: [
      { name: '日终结算', type: 'scheduled', cron: '0 22 * * *' },
      { name: '数据同步', type: 'realtime' },
      { name: '账单生成', type: 'scheduled', cron: '0 0 * * 1' }
    ],
    callbacks: [
      { service: '支付服务', url: 'http://new-cluster.example.com/api/payments/callback' },
      { service: '订单服务', url: 'http://new-cluster.example.com/api/orders/callback' }
    ]
  };

  const tenant2OldSnapshot = {
    dataCount: 28956,
    permissions: ['read', 'write', 'admin', 'report', 'audit'],
    tasks: [
      { name: '库存盘点', type: 'scheduled', cron: '0 3 * * *' },
      { name: '会员积分同步', type: 'realtime' },
      { name: '促销活动生效', type: 'scheduled', cron: '0 0 * * *' }
    ],
    callbacks: [
      { service: '库存服务', url: 'http://old-cluster.example.com/api/inventory/callback' },
      { service: '会员服务', url: 'http://old-cluster.example.com/api/members/callback' }
    ]
  };

  const tenant2NewSnapshot = {
    dataCount: 28956,
    permissions: ['read', 'write', 'admin', 'report'],
    tasks: [
      { name: '库存盘点', type: 'scheduled', cron: '0 3 * * *' },
      { name: '会员积分同步', type: 'realtime' },
      { name: '促销活动生效', type: 'scheduled', cron: '0 0 * * *' }
    ],
    callbacks: [
      { service: '库存服务', url: 'http://new-cluster.example.com/api/inventory/callback' },
      { service: '会员服务', url: 'http://new-cluster.example.com/api/members/callback' }
    ]
  };

  const tenant3OldSnapshot = {
    dataCount: 45872,
    permissions: ['read', 'write', 'admin', 'report', 'audit', 'risk'],
    tasks: [
      { name: '风险评估', type: 'scheduled', cron: '0 */6 * * *' },
      { name: '交易对账', type: 'scheduled', cron: '0 1 * * *' },
      { name: '客户数据同步', type: 'realtime' }
    ],
    callbacks: [
      { service: '交易服务', url: 'http://old-cluster.example.com/api/transactions/callback' },
      { service: '风险服务', url: 'http://old-cluster.example.com/api/risk/callback' }
    ]
  };

  const tenant3NewSnapshot = {
    dataCount: 45872,
    permissions: ['read', 'write', 'admin', 'report', 'audit', 'risk'],
    tasks: [
      { name: '风险评估', type: 'scheduled', cron: '0 */6 * * *' },
      { name: '交易对账', type: 'scheduled', cron: '0 1 * * *' },
      { name: '客户数据同步', type: 'realtime' }
    ],
    callbacks: [
      { service: '交易服务', url: 'http://old-cluster.example.com/api/transactions/callback' },
      { service: '风险服务', url: 'http://old-cluster.example.com/api/risk/callback' }
    ]
  };

  const snapshots = [
    { tenantId: tenant1Id, environment: 'old', data: tenant1OldSnapshot },
    { tenantId: tenant1Id, environment: 'new', data: tenant1NewSnapshot },
    { tenantId: tenant2Id, environment: 'old', data: tenant2OldSnapshot },
    { tenantId: tenant2Id, environment: 'new', data: tenant2NewSnapshot },
    { tenantId: tenant3Id, environment: 'old', data: tenant3OldSnapshot },
    { tenantId: tenant3Id, environment: 'new', data: tenant3NewSnapshot }
  ];

  for (const snapshot of snapshots) {
    runQuery(`
      INSERT INTO snapshots (id, tenant_id, environment, imported_at, data)
      VALUES (?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      snapshot.tenantId,
      snapshot.environment,
      now,
      JSON.stringify(snapshot.data)
    ]);
  }

  const tenant1Diffs = [
    { type: 'data', status: 'confirmed', conclusion: '数据量完全一致，15234条记录', hasManualConclusion: 0 },
    { type: 'permission', status: 'confirmed', conclusion: '4个权限完全一致', hasManualConclusion: 0 },
    { type: 'task', status: 'confirmed', conclusion: '3个定时任务配置一致', hasManualConclusion: 0 },
    { type: 'callback', status: 'confirmed', conclusion: '2个回调地址已切换到新集群', hasManualConclusion: 0 }
  ];

  const tenant2Diffs = [
    { type: 'data', status: 'confirmed', conclusion: '数据量完全一致，28956条记录', hasManualConclusion: 0 },
    { type: 'permission', status: 'pending', conclusion: '新环境缺少audit权限', hasManualConclusion: 0 },
    { type: 'task', status: 'confirmed', conclusion: '3个定时任务配置一致', hasManualConclusion: 0 },
    { type: 'callback', status: 'confirmed', conclusion: '2个回调地址已切换到新集群', hasManualConclusion: 0 }
  ];

  const tenant3Diffs = [
    { type: 'data', status: 'confirmed', conclusion: '数据量完全一致，45872条记录', hasManualConclusion: 0 },
    { type: 'permission', status: 'confirmed', conclusion: '6个权限完全一致', hasManualConclusion: 0 },
    { type: 'task', status: 'retry', conclusion: '待重新校验定时任务状态', hasManualConclusion: 1 },
    { type: 'callback', status: 'pending', conclusion: '2个回调地址仍指向旧集群', hasManualConclusion: 0 }
  ];

  const allDiffs = [
    { tenantId: tenant1Id, diffs: tenant1Diffs },
    { tenantId: tenant2Id, diffs: tenant2Diffs },
    { tenantId: tenant3Id, diffs: tenant3Diffs }
  ];

  for (const item of allDiffs) {
    for (const diff of item.diffs) {
      runQuery(`
        INSERT INTO diffs (id, tenant_id, type, status, conclusion, created_at, updated_at, has_manual_conclusion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(),
        item.tenantId,
        diff.type,
        diff.status,
        diff.conclusion,
        now,
        now,
        diff.hasManualConclusion
      ]);
    }
  }

  const tenant1Callbacks = [
    { service: '支付服务', oldUrl: 'http://old-cluster.example.com/api/payments/callback', newUrl: 'http://new-cluster.example.com/api/payments/callback', isSwitched: 1 },
    { service: '订单服务', oldUrl: 'http://old-cluster.example.com/api/orders/callback', newUrl: 'http://new-cluster.example.com/api/orders/callback', isSwitched: 1 }
  ];

  const tenant2Callbacks = [
    { service: '库存服务', oldUrl: 'http://old-cluster.example.com/api/inventory/callback', newUrl: 'http://new-cluster.example.com/api/inventory/callback', isSwitched: 1 },
    { service: '会员服务', oldUrl: 'http://old-cluster.example.com/api/members/callback', newUrl: 'http://new-cluster.example.com/api/members/callback', isSwitched: 1 }
  ];

  const tenant3Callbacks = [
    { service: '交易服务', oldUrl: 'http://old-cluster.example.com/api/transactions/callback', newUrl: 'http://new-cluster.example.com/api/transactions/callback', isSwitched: 0 },
    { service: '风险服务', oldUrl: 'http://old-cluster.example.com/api/risk/callback', newUrl: 'http://new-cluster.example.com/api/risk/callback', isSwitched: 0 }
  ];

  const allCallbacks = [
    { tenantId: tenant1Id, callbacks: tenant1Callbacks },
    { tenantId: tenant2Id, callbacks: tenant2Callbacks },
    { tenantId: tenant3Id, callbacks: tenant3Callbacks }
  ];

  for (const item of allCallbacks) {
    for (const cb of item.callbacks) {
      runQuery(`
        INSERT INTO callbacks (id, tenant_id, service_name, old_url, new_url, is_switched, switched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(),
        item.tenantId,
        cb.service,
        cb.oldUrl,
        cb.newUrl,
        cb.isSwitched,
        cb.isSwitched ? now : null
      ]);
    }
  }

  const tenant1Tasks = [
    { name: '日终结算', type: 'scheduled', isFrozen: 0 },
    { name: '数据同步', type: 'realtime', isFrozen: 0 },
    { name: '账单生成', type: 'scheduled', isFrozen: 0 }
  ];

  const tenant2Tasks = [
    { name: '库存盘点', type: 'scheduled', isFrozen: 0 },
    { name: '会员积分同步', type: 'realtime', isFrozen: 0 },
    { name: '促销活动生效', type: 'scheduled', isFrozen: 0 }
  ];

  const tenant3Tasks = [
    { name: '风险评估', type: 'scheduled', isFrozen: 1 },
    { name: '交易对账', type: 'scheduled', isFrozen: 0 },
    { name: '客户数据同步', type: 'realtime', isFrozen: 0 }
  ];

  const allTasks = [
    { tenantId: tenant1Id, tasks: tenant1Tasks },
    { tenantId: tenant2Id, tasks: tenant2Tasks },
    { tenantId: tenant3Id, tasks: tenant3Tasks }
  ];

  for (const item of allTasks) {
    for (const task of item.tasks) {
      runQuery(`
        INSERT INTO tasks (id, tenant_id, task_name, task_type, is_frozen, frozen_at, unfrozen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(),
        item.tenantId,
        task.name,
        task.type,
        task.isFrozen,
        task.isFrozen ? now : null,
        null
      ]);
    }
  }
}
