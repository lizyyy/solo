import { ReturnApplication, ReturnStatus, DeviceItem, OperationLog } from '../../shared/types';

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
};

const createDevice = (deviceId: string, borrowTeam: string, borrowDate: string): DeviceItem => ({
  deviceId,
  deviceType: ['adult', 'child', 'group'][Math.floor(Math.random() * 3)] as any,
  batteryStatus: ['full', 'normal', 'low', 'charge'][Math.floor(Math.random() * 4)] as any,
  borrowDate,
  borrowTeam,
  condition: Math.random() > 0.9 ? 'damaged' : 'normal',
  remarks: Math.random() > 0.8 ? '设备有轻微划痕' : ''
});

const createLog = (action: string, operator: string, remarks: string = ''): OperationLog => ({
  id: generateId(),
  action,
  operator,
  time: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
  remarks
});

export const mockReturns: ReturnApplication[] = [
  {
    id: 'GH20240501001',
    teamName: '青铜器展厅讲解一组',
    responsiblePerson: '张明',
    phone: '13800138001',
    returnDate: '2024-05-01',
    submitSource: 'web',
    submitTime: '2024-05-01T14:30:00',
    operator: '张明',
    status: ReturnStatus.PENDING,
    deviceCount: 15,
    devices: Array.from({ length: 15 }, (_, i) => 
      createDevice(`DJQ-${String(i + 1).padStart(3, '0')}-A`, '青铜器展厅讲解一组', '2024-04-30')
    ),
    operationLogs: [
      createLog('创建归还申请', '张明', '提交15台讲解器归还'),
      createLog('提交审核', '张明', '')
    ],
    validationIssues: []
  },
  {
    id: 'GH20240501002',
    teamName: '书画展厅讲解二组',
    responsiblePerson: '李华',
    phone: '13800138002',
    returnDate: '2024-05-01',
    submitSource: 'miniapp',
    submitTime: '2024-05-01T15:00:00',
    operator: '李华',
    status: ReturnStatus.OWNERSHIP_ISSUE,
    deviceCount: 10,
    devices: [
      ...Array.from({ length: 8 }, (_, i) => 
        createDevice(`DJQ-${String(20 + i).padStart(3, '0')}-B`, '书画展厅讲解二组', '2024-04-29')
      ),
      createDevice('DJQ-030-B', '书画展厅讲解一组', '2024-04-28'),
      createDevice('DJQ-031-B', '临时讲解组', '2024-04-28')
    ],
    operationLogs: [
      createLog('创建归还申请', '李华', '提交10台讲解器归还'),
      createLog('系统校验', '系统', '检测到2台设备归属团队不一致'),
      createLog('标记归属问题', '管理员王芳', '需要确认DJQ-030-B和DJQ-031-B归属')
    ],
    validationIssues: [
      {
        type: 'ownership',
        severity: 'warning',
        message: '设备DJQ-030-B借出团队为"书画展厅讲解一组"，与归还团队不一致',
        deviceId: 'DJQ-030-B'
      },
      {
        type: 'ownership',
        severity: 'warning',
        message: '设备DJQ-031-B借出团队为"临时讲解组"，与归还团队不一致',
        deviceId: 'DJQ-031-B'
      }
    ]
  },
  {
    id: 'GH20240430003',
    teamName: '陶瓷展厅讲解三组',
    responsiblePerson: '王芳',
    phone: '13800138003',
    returnDate: '2024-04-30',
    submitSource: 'backend',
    submitTime: '2024-04-30T16:00:00',
    operator: '管理员王芳',
    status: ReturnStatus.APPROVED,
    deviceCount: 20,
    devices: Array.from({ length: 20 }, (_, i) => 
      createDevice(`DJQ-${String(50 + i).padStart(3, '0')}-C`, '陶瓷展厅讲解三组', '2024-04-28')
    ),
    operationLogs: [
      createLog('后台录入', '管理员王芳', '代录入陶瓷三组归还申请'),
      createLog('审核通过', '管理员王芳', '')
    ],
    validationIssues: []
  },
  {
    id: 'GH20240429004',
    teamName: '玉器展厅讲解一组',
    responsiblePerson: '刘强',
    phone: '13800138004',
    returnDate: '2024-04-29',
    submitSource: 'web',
    submitTime: '2024-04-29T11:00:00',
    operator: '刘强',
    status: ReturnStatus.COMPLETED,
    deviceCount: 12,
    devices: Array.from({ length: 12 }, (_, i) => 
      createDevice(`DJQ-${String(80 + i).padStart(3, '0')}-D`, '玉器展厅讲解一组', '2024-04-27')
    ),
    operationLogs: [
      createLog('创建归还申请', '刘强', '提交12台讲解器归还'),
      createLog('审核通过', '管理员张伟', ''),
      createLog('设备入库', '库管员赵丽', '全部设备入库完成')
    ],
    validationIssues: []
  },
  {
    id: 'GH20240428005',
    teamName: '雕塑展厅讲解二组',
    responsiblePerson: '陈静',
    phone: '13800138005',
    returnDate: '2024-04-28',
    submitSource: 'web',
    submitTime: '2024-04-28T09:00:00',
    operator: '陈静',
    status: ReturnStatus.REJECTED,
    deviceCount: 8,
    devices: Array.from({ length: 8 }, (_, i) => 
      createDevice(`DJQ-${String(100 + i).padStart(3, '0')}-E`, '雕塑展厅讲解二组', '2024-04-26')
    ),
    operationLogs: [
      createLog('创建归还申请', '陈静', '提交8台讲解器归还'),
      createLog('审核驳回', '管理员张伟', '设备清单与申请数量不符，实际只有7台')
    ],
    validationIssues: [
      {
        type: 'count_mismatch',
        severity: 'error',
        message: '申请数量8台，实际清单只有7台，数量不一致'
      }
    ]
  },
  {
    id: 'GH20240427006',
    teamName: '古籍展厅讲解一组',
    responsiblePerson: '周伟',
    phone: '13800138006',
    returnDate: '2024-04-27',
    submitSource: 'miniapp',
    submitTime: '2024-04-27T13:30:00',
    operator: '周伟',
    status: ReturnStatus.PROCESSING,
    deviceCount: 5,
    devices: [
      ...Array.from({ length: 4 }, (_, i) => 
        createDevice(`DJQ-${String(120 + i).padStart(3, '0')}-F`, '古籍展厅讲解一组', '2024-04-25')
      ),
      {
        deviceId: 'DJQ-125-F',
        deviceType: 'adult',
        batteryStatus: 'charge',
        borrowDate: '2024-04-25',
        borrowTeam: '古籍展厅讲解一组',
        condition: 'lost',
        remarks: '讲解结束后未归还，疑似丢失'
      }
    ],
    operationLogs: [
      createLog('创建归还申请', '周伟', '提交5台讲解器归还，其中1台丢失'),
      createLog('标记问题处理', '管理员李娜', '丢失设备正在追踪中')
    ],
    validationIssues: [
      {
        type: 'other',
        severity: 'error',
        message: '设备DJQ-125-F状态为丢失，需特殊处理',
        deviceId: 'DJQ-125-F'
      }
    ]
  },
  {
    id: 'GH20240426007',
    teamName: '钱币展厅讲解三组',
    responsiblePerson: '吴敏',
    phone: '13800138007',
    returnDate: '2024-04-26',
    submitSource: 'web',
    submitTime: '2024-04-26T10:00:00',
    operator: '吴敏',
    status: ReturnStatus.STORED,
    deviceCount: 18,
    devices: Array.from({ length: 18 }, (_, i) => 
      createDevice(`DJQ-${String(140 + i).padStart(3, '0')}-G`, '钱币展厅讲解三组', '2024-04-24')
    ),
    operationLogs: [
      createLog('创建归还申请', '吴敏', '提交18台讲解器归还'),
      createLog('审核通过', '管理员李娜', ''),
      createLog('设备入库', '库管员赵丽', '18台设备全部入库')
    ],
    validationIssues: []
  },
  {
    id: 'GH20240425008',
    teamName: '化石展厅讲解一组',
    responsiblePerson: '郑涛',
    phone: '13800138008',
    returnDate: '2024-04-25',
    submitSource: 'backend',
    submitTime: '2024-04-25T15:00:00',
    operator: '管理员王芳',
    status: ReturnStatus.COMPLETED,
    deviceCount: 25,
    devices: Array.from({ length: 25 }, (_, i) => 
      createDevice(`DJQ-${String(170 + i).padStart(3, '0')}-H`, '化石展厅讲解一组', '2024-04-23')
    ),
    operationLogs: [
      createLog('后台录入', '管理员王芳', '代录入化石一组归还申请'),
      createLog('审核通过', '管理员张伟', ''),
      createLog('设备入库', '库管员赵丽', '25台设备全部入库'),
      createLog('流程完成', '系统', '归还流程正常结束')
    ],
    validationIssues: []
  },
  {
    id: 'GH20240424009',
    teamName: '钟表展厅讲解二组',
    responsiblePerson: '孙磊',
    phone: '13800138009',
    returnDate: '2024-04-24',
    submitSource: 'web',
    submitTime: '2024-04-24T11:30:00',
    operator: '孙磊',
    status: ReturnStatus.ISSUE_RECORDED,
    deviceCount: 6,
    devices: Array.from({ length: 6 }, (_, i) => 
      createDevice(`DJQ-${String(200 + i).padStart(3, '0')}-I`, '钟表展厅讲解二组', '2024-04-22')
    ).map(d => ({ ...d, condition: 'damaged' as const, remarks: '批量损坏，送修处理' })),
    operationLogs: [
      createLog('创建归还申请', '孙磊', '提交6台讲解器归还，全部损坏'),
      createLog('记录问题', '管理员李娜', '设备已记录送修，等待厂家处理')
    ],
    validationIssues: [
      {
        type: 'other',
        severity: 'error',
        message: '6台设备全部损坏，已记录问题并安排送修'
      }
    ]
  },
  {
    id: 'GH20240502010',
    teamName: '印章展厅讲解一组',
    responsiblePerson: '黄磊',
    phone: '13800138010',
    returnDate: '2024-05-02',
    submitSource: 'web',
    submitTime: '2024-05-02T09:00:00',
    operator: '黄磊',
    status: ReturnStatus.DRAFT,
    deviceCount: 9,
    devices: Array.from({ length: 9 }, (_, i) => 
      createDevice(`DJQ-${String(220 + i).padStart(3, '0')}-J`, '印章展厅讲解一组', '2024-04-30')
    ),
    operationLogs: [
      createLog('创建草稿', '黄磊', '归还申请尚未提交')
    ],
    validationIssues: []
  }
];
