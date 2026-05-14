import { db, Certificate, Whitelist, AnomalySample, BusReservation } from './database';

const departments = [
  '信息技术部',
  '人力资源部',
  '财务部',
  '市场部',
  '运营部',
  '研发中心',
  '客户服务部',
  '合规部',
  '行政部',
  '采购部'
];

const operators = [
  '张三',
  '李四',
  '王五',
  '赵六',
  '陈七'
];

const riskTypes = [
  '权限异常',
  '数据泄露风险',
  '未授权访问',
  '证书过期',
  '白名单异常',
  '操作审计异常',
  '敏感数据暴露'
];

const busRoutes = [
  'A线-科技园至总部',
  'B线-高新区至总部',
  'C线-软件园至总部',
  'D线-望京至总部',
  'E线-亦庄至总部'
];

function generateBatchId(): string {
  const date = new Date();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BATCH-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${random}`;
}

function generateCertNumber(): string {
  const prefix = ['CERT', 'LIC', 'AUTH', 'PERM'][Math.floor(Math.random() * 4)];
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function generateEmployeeId(): string {
  return `EMP${(10000 + Math.floor(Math.random() * 90000)).toString()}`;
}

function randomDate(start: Date, end: Date): string {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function generateDemoData(): Promise<void> {
  await db.waitReady();

  const batch1 = generateBatchId();
  const batch2 = generateBatchId();
  const batch3 = generateBatchId();
  const now = new Date().toISOString();

  const offlineCerts: Certificate[] = [
    {
      certNumber: generateCertNumber(),
      applicant: '李明',
      department: '信息技术部',
      issueDate: randomDate(new Date('2024-01-01'), new Date('2024-03-01')),
      expireDate: randomDate(new Date('2025-01-01'), new Date('2025-12-31')),
      status: 'issued',
      issuer: '合规部-王经理',
      batchId: batch1,
      isOffline: true,
      originalData: JSON.stringify({
        formId: 'FRM-OFF-2024-001',
        applicantPhone: '13800138001',
        approvalChain: ['张三审批', '李四复核', '王五终审'],
        attachments: ['身份证扫描件', '申请表扫描件', '部门证明']
      })
    },
    {
      certNumber: generateCertNumber(),
      applicant: '王芳',
      department: '财务部',
      issueDate: randomDate(new Date('2024-02-01'), new Date('2024-04-01')),
      expireDate: randomDate(new Date('2025-02-01'), new Date('2025-12-31')),
      status: 'issued',
      issuer: '合规部-李主管',
      batchId: batch1,
      isOffline: true,
      originalData: JSON.stringify({
        formId: 'FRM-OFF-2024-002',
        applicantPhone: '13800138002',
        approvalChain: ['赵六审批', '钱七复核'],
        attachments: ['财务权限申请单', '岗位证明']
      })
    },
    {
      certNumber: generateCertNumber(),
      applicant: '张伟',
      department: '研发中心',
      issueDate: randomDate(new Date('2024-03-01'), new Date('2024-05-01')),
      expireDate: randomDate(new Date('2025-03-01'), new Date('2025-12-31')),
      status: 'issued',
      issuer: '信息技术部-孙总监',
      batchId: batch1,
      isOffline: true,
      originalData: JSON.stringify({
        formId: 'FRM-OFF-2024-003',
        applicantPhone: '13800138003',
        approvalChain: ['周八审批', '吴九复核', '郑十终审'],
        attachments: ['系统权限申请', '项目审批单']
      })
    }
  ];

  for (const cert of offlineCerts) {
    await db.insertCertificate(cert);
  }

  const whitelists: Whitelist[] = [
    {
      employeeId: generateEmployeeId(),
      employeeName: '临时用户-刘工',
      department: '研发中心',
      reason: '项目外协开发，需要临时访问生产环境',
      startDate: randomDate(new Date('2024-05-01'), new Date('2024-05-10')),
      endDate: randomDate(new Date('2024-08-01'), new Date('2024-08-30')),
      isTemporary: true,
      isRevoked: false,
      operator: randomItem(operators),
      batchId: batch2,
      createdAt: now
    },
    {
      employeeId: generateEmployeeId(),
      employeeName: '陈工程师',
      department: '信息技术部',
      reason: '运维值班临时权限',
      startDate: randomDate(new Date('2024-04-01'), new Date('2024-04-10')),
      endDate: randomDate(new Date('2024-07-01'), new Date('2024-07-30')),
      isTemporary: true,
      isRevoked: true,
      operator: randomItem(operators),
      batchId: batch2,
      createdAt: now
    },
    {
      employeeId: generateEmployeeId(),
      employeeName: '王系统',
      department: '信息技术部',
      reason: '系统管理员永久白名单',
      startDate: '2023-01-01',
      endDate: '2099-12-31',
      isTemporary: false,
      isRevoked: false,
      operator: randomItem(operators),
      batchId: batch2,
      createdAt: now
    },
    {
      employeeId: generateEmployeeId(),
      employeeName: '李审计',
      department: '合规部',
      reason: '审计专项权限',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      isTemporary: false,
      isRevoked: false,
      operator: randomItem(operators),
      batchId: batch2,
      createdAt: now
    }
  ];

  for (const wl of whitelists) {
    await db.insertWhitelist(wl);
  }

  const anomalySamples: AnomalySample[] = [
    {
      sampleId: `ANOM-${Date.now()}-001`,
      riskType: '权限异常',
      description: '发现离职员工账号仍有登录记录，最近一次登录时间为离职后第3天',
      source: '登录日志监控系统',
      discoveredAt: now,
      discoveredBy: '合规部-张审计',
      status: 'pending',
      originalData: JSON.stringify({
        loginRecords: [
          { time: '2024-05-15 09:30:22', ip: '192.168.1.100', location: '北京总部' },
          { time: '2024-05-16 14:20:11', ip: '192.168.1.101', location: '北京总部' }
        ],
        employeeStatus: '已离职',
        lastWorkingDay: '2024-05-12'
      }),
      relatedBatchId: batch2
    },
    {
      sampleId: `ANOM-${Date.now()}-002`,
      riskType: '数据泄露风险',
      description: '检测到大量敏感数据导出操作，单小时导出超过1000条客户信息',
      source: '数据防泄漏系统',
      discoveredAt: now,
      discoveredBy: '信息技术部-李监控',
      status: 'reviewed',
      originalData: JSON.stringify({
        exportTime: '2024-05-10 15:00-16:00',
        exportCount: 1256,
        dataType: '客户联系方式',
        operator: '市场部-王某某',
        justification: '季度营销活动数据准备，已报备'
      }),
      relatedBatchId: batch1
    },
    {
      sampleId: `ANOM-${Date.now()}-003`,
      riskType: '白名单异常',
      description: '临时白名单到期未撤销，超期已达15天',
      source: '白名单定期巡检',
      discoveredAt: now,
      discoveredBy: '运维组-赵巡检',
      status: 'pending',
      originalData: JSON.stringify({
        whitelistId: 'WL-2024-0042',
        expectedExpire: '2024-04-30',
        actualStatus: '仍生效',
        overdueDays: 15
      }),
      relatedBatchId: batch2
    },
    {
      sampleId: `ANOM-${Date.now()}-004`,
      riskType: '证书过期',
      description: '3张生产环境证书将在30天内过期，其中1张已过期5天',
      source: '证书监控系统',
      discoveredAt: now,
      discoveredBy: '系统组-孙监控',
      status: 'resolved',
      originalData: JSON.stringify({
        expiringCerts: [
          { certId: 'CERT-001', expireDate: '2024-05-10', daysLeft: -5 },
          { certId: 'CERT-002', expireDate: '2024-06-01', daysLeft: 17 },
          { certId: 'CERT-003', expireDate: '2024-06-15', daysLeft: 31 }
        ],
        resolution: 'CERT-001已续期，其他正在走审批流程'
      }),
      relatedBatchId: batch1
    }
  ];

  for (const sample of anomalySamples) {
    await db.insertAnomalySample(sample);
  }

  const busReservations: BusReservation[] = [
    {
      rowNumber: 1,
      employeeId: generateEmployeeId(),
      employeeName: '周小红',
      department: '市场部',
      route: busRoutes[0],
      reservationDate: '2024-05-20',
      manualNote: '备注：携带大件设备，请预留前排座位',
      batchId: batch3,
      importedAt: now
    },
    {
      rowNumber: 2,
      employeeId: generateEmployeeId(),
      employeeName: '吴大明',
      department: '研发中心',
      route: busRoutes[1],
      reservationDate: '2024-05-20',
      manualNote: '',
      batchId: batch3,
      importedAt: now
    },
    {
      rowNumber: 3,
      employeeId: generateEmployeeId(),
      employeeName: '郑美丽',
      department: '人力资源部',
      route: busRoutes[0],
      reservationDate: '2024-05-20',
      manualNote: '备注：孕妇，需要特殊照顾',
      batchId: batch3,
      importedAt: now
    },
    {
      rowNumber: 4,
      employeeId: generateEmployeeId(),
      employeeName: '孙小强',
      department: '财务部',
      route: busRoutes[2],
      reservationDate: '2024-05-20',
      manualNote: '备注：晕车，尽量安排前排',
      batchId: batch3,
      importedAt: now
    },
    {
      rowNumber: 5,
      employeeId: generateEmployeeId(),
      employeeName: '马小云',
      department: '运营部',
      route: busRoutes[1],
      reservationDate: '2024-05-20',
      manualNote: '',
      batchId: batch3,
      importedAt: now
    },
    {
      rowNumber: 6,
      employeeId: generateEmployeeId(),
      employeeName: '朱小莉',
      department: '客户服务部',
      route: busRoutes[0],
      reservationDate: '2024-05-20',
      manualNote: '备注：晚走10分钟，能否等一下？',
      batchId: batch3,
      importedAt: now
    },
    {
      rowNumber: 7,
      employeeId: generateEmployeeId(),
      employeeName: '胡小东',
      department: '研发中心',
      route: busRoutes[3],
      reservationDate: '2024-05-20',
      manualNote: '',
      batchId: batch3,
      importedAt: now
    },
    {
      rowNumber: 8,
      employeeId: generateEmployeeId(),
      employeeName: '林小西',
      department: '信息技术部',
      route: busRoutes[0],
      reservationDate: '2024-05-20',
      manualNote: '备注：带实习生一名同行',
      batchId: batch3,
      importedAt: now
    }
  ];

  for (const res of busReservations) {
    await db.insertBusReservation(res);
  }

  await db.insertOperationLog({
    operationType: '导入离线证书',
    operator: '李四',
    batchId: batch1,
    affectedCount: offlineCerts.length,
    description: '批量导入3份离线签发的访问证书',
    executedAt: now,
    isRollback: false
  });

  await db.insertOperationLog({
    operationType: '添加白名单',
    operator: '张三',
    batchId: batch2,
    affectedCount: whitelists.length,
    description: '批量添加4条白名单记录，包含1条临时白名单',
    executedAt: now,
    isRollback: false
  });

  await db.insertOperationLog({
    operationType: '导入班车预约',
    operator: '王五',
    batchId: batch3,
    affectedCount: busReservations.length,
    description: '导入班车预约名单8条，含4条人工备注',
    executedAt: now,
    isRollback: false
  });

  console.log('演示数据生成完成！');
  console.log(`- 离线证书批次: ${batch1} (${offlineCerts.length}条)`);
  console.log(`- 白名单批次: ${batch2} (${whitelists.length}条，含1条未撤销临时白名单)`);
  console.log(`- 异常样本: ${anomalySamples.length}条`);
  console.log(`- 班车预约批次: ${batch3} (${busReservations.length}条，含人工备注)`);
}
