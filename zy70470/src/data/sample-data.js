module.exports = [
  {
    id: 'REC-20240515-GRAY-001',
    title: '跨天灰度发布备忘-用户中心v2.3.0',
    type: 'grayscale_release',
    status: 'investigating',
    severity: 'high',
    source: '运维监控系统',
    detectedAt: '2024-05-15T03:42:18+08:00',
    description: '用户中心服务跨天灰度发布过程中发现异常，部分用户登录态丢失，影响面约15%',
    affectedResources: [
      { id: 'SVC-USER-001', name: 'user-center-service', type: 'microservice', environment: 'production', businessCritical: true },
      { id: 'REDIS-USER-001', name: 'user-session-redis-cluster', type: 'cache', environment: 'production', businessCritical: true },
      { id: 'DB-USER-001', name: 'user-db-primary', type: 'database', environment: 'production', businessCritical: true },
      { id: 'CFG-GRAY-023', name: 'gray-release-config-v230', type: 'configuration', environment: 'production', businessCritical: false }
    ],
    candidateActions: [
      {
        id: 'ACT-001',
        type: 'rollback',
        description: '回滚用户中心服务至v2.2.1稳定版',
        targetResources: ['SVC-USER-001'],
        suggestedBy: 'system-auto',
        suggestedAt: '2024-05-15T03:45:00+08:00',
        riskLevel: 'low',
        justification: 'v2.2.1为经过72小时稳定运行的版本，回滚可快速恢复服务'
      },
      {
        id: 'ACT-002',
        type: 'scale_out',
        description: '临时扩容Redis集群节点，缓解会话压力',
        targetResources: ['REDIS-USER-001'],
        suggestedBy: 'zhang.wei@company.com',
        suggestedAt: '2024-05-15T04:12:00+08:00',
        riskLevel: 'medium',
        justification: '监控显示Redis连接数异常增长，扩容可缓解当前压力'
      }
    ],
    approvedActions: [],
    manualCorrections: [],
    fieldMetadata: {},
    createdBy: 'monitor-bot',
    assignedTo: 'wang.gang@company.com',
    tags: ['灰度发布', '跨天发布', '用户中心', '会话异常'],
    comments: [
      { author: 'li.ming@company.com', content: '建议先在预发布环境验证回滚方案', createdAt: '2024-05-15T04:30:00+08:00' }
    ]
  },
  {
    id: 'REC-20240514-PERM-007',
    title: '权限误放大告警-运营部临时权限',
    type: 'permission_escalation',
    status: 'pending_review',
    severity: 'critical',
    source: 'IAM审计系统',
    detectedAt: '2024-05-14T18:22:05+08:00',
    description: '运营部员工chen.lan申请的临时报表查看权限，被系统误放大为全量数据导出权限',
    affectedResources: [
      { id: 'ROLE-OP-002', name: 'operation-data-viewer', type: 'admin_role', environment: 'production', businessCritical: true },
      { id: 'POL-OP-045', name: 'data-export-policy', type: 'policy', environment: 'production', businessCritical: true },
      { id: 'USER-OP-128', name: 'chen.lan@company.com', type: 'user_account', environment: 'production', businessCritical: false },
      { id: 'DB-REPORT-003', name: 'business-report-db', type: 'database', environment: 'production', businessCritical: true }
    ],
    candidateActions: [
      {
        id: 'ACT-003',
        type: 'revoke_permissions',
        description: '立即撤销chen.lan的全量数据导出权限',
        targetResources: ['USER-OP-128', 'ROLE-OP-002'],
        suggestedBy: 'iam-audit-system',
        suggestedAt: '2024-05-14T18:25:00+08:00',
        riskLevel: 'medium',
        justification: '权限超出申请范围，存在数据泄露风险'
      },
      {
        id: 'ACT-004',
        type: 'audit_log',
        description: '导出并审计该账号近7天所有操作日志',
        targetResources: ['USER-OP-128'],
        suggestedBy: 'security-team',
        suggestedAt: '2024-05-14T19:00:00+08:00',
        riskLevel: 'low',
        justification: '排查是否存在敏感数据导出行为'
      },
      {
        id: 'ACT-005',
        type: 'policy_fix',
        description: '修复权限分配策略中的逻辑漏洞',
        targetResources: ['POL-OP-045'],
        suggestedBy: 'security-team',
        suggestedAt: '2024-05-14T19:30:00+08:00',
        riskLevel: 'high',
        justification: '防止类似问题再次发生'
      }
    ],
    approvedActions: [],
    manualCorrections: [],
    fieldMetadata: {},
    createdBy: 'iam-audit-bot',
    assignedTo: 'security@company.com',
    tags: ['权限放大', 'IAM审计', '数据安全', '临时权限'],
    comments: [
      { author: 'security@company.com', content: '已通知当事人，暂停该账号所有敏感操作', createdAt: '2024-05-14T18:40:00+08:00' },
      { author: 'audit@company.com', content: '正在调取操作日志进行分析', createdAt: '2024-05-14T19:15:00+08:00' }
    ]
  },
  {
    id: 'REC-20240513-FAC-042',
    title: '物业报修单处理状态修正',
    type: 'facility_repair',
    status: 'resolved',
    severity: 'low',
    source: '物业报修系统',
    detectedAt: '2024-05-13T09:15:00+08:00',
    description: '总部大楼12层茶水间咖啡机报修单状态异常，系统显示"已完成"但实际未维修',
    affectedResources: [
      { id: 'FA-EQ-1205', name: '12层茶水间咖啡机', type: 'equipment', environment: 'office', businessCritical: false },
      { id: 'FA-WO-20240512-089', name: '报修工单WO-20240512-089', type: 'work_order', environment: 'office', businessCritical: false }
    ],
    candidateActions: [
      {
        id: 'ACT-006',
        type: 'reopen_ticket',
        description: '重新开立交修工单',
        targetResources: ['FA-WO-20240512-089'],
        suggestedBy: 'system',
        suggestedAt: '2024-05-13T09:20:00+08:00',
        riskLevel: 'low',
        justification: '设备确实未维修，需要重新派单'
      }
    ],
    approvedActions: [
      {
        id: 'ACT-006',
        type: 'reopen_ticket',
        description: '重新开立交修工单',
        targetResources: ['FA-WO-20240512-089'],
        suggestedBy: 'system',
        suggestedAt: '2024-05-13T09:20:00+08:00',
        riskLevel: 'low',
        justification: '设备确实未维修，需要重新派单',
        approvedBy: 'admin.facility@company.com',
        approvedAt: '2024-05-13T09:35:00+08:00',
        approvalRemark: '已核实，同意重新派单',
        status: 'approved'
      }
    ],
    manualCorrections: [
      {
        id: 'COR-001',
        fieldPath: 'status',
        oldValue: 'completed',
        newValue: 'in_progress',
        correctedBy: 'zhao.yi@company.com',
        correctedAt: '2024-05-13T10:00:00+08:00',
        reason: '现场核查咖啡机确实未维修，系统状态同步异常导致误标已完成',
        sourceEvidence: '现场照片FA-20240513-1001.jpg、物业人员签字确认单'
      },
      {
        id: 'COR-002',
        fieldPath: 'description',
        oldValue: '咖啡机故障报修',
        newValue: '咖啡机故障报修（系统状态误标已完成，实际未维修）',
        correctedBy: 'zhao.yi@company.com',
        correctedAt: '2024-05-13T10:05:00+08:00',
        reason: '补充系统异常说明，便于后续追溯',
        sourceEvidence: '工单系统操作日志ID:LOG-20240513-00156'
      }
    ],
    fieldMetadata: {
      'status': {
        'source': '现场照片FA-20240513-1001.jpg、物业人员签字确认单',
        'lastModified': '2024-05-13T10:00:00+08:00',
        'modifiedBy': 'zhao.yi@company.com',
        'justification': '现场核查咖啡机确实未维修，系统状态同步异常导致误标已完成'
      },
      'description': {
        'source': '工单系统操作日志ID:LOG-20240513-00156',
        'lastModified': '2024-05-13T10:05:00+08:00',
        'modifiedBy': 'zhao.yi@company.com',
        'justification': '补充系统异常说明，便于后续追溯'
      }
    },
    createdBy: 'facility-system',
    assignedTo: 'zhao.yi@company.com',
    tags: ['物业报修', '状态修正', '咖啡机', '12层'],
    comments: [
      { author: 'zhao.yi@company.com', content: '已联系维修人员今天下午上门处理', createdAt: '2024-05-13T10:10:00+08:00' }
    ]
  }
];