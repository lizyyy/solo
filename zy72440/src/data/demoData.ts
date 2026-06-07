import type { InventoryRecord } from '@/types';

export const demoRecords: InventoryRecord[] = [
  {
    id: 'demo-001',
    artistName: '张明演唱会',
    merchandise: '应援棒',
    quantity: 500,
    authorizedRegions: [
      { city: '北京' },
      { city: '上海' },
      { city: '广州' },
      { city: '深圳' }
    ],
    status: 'completed',
    currentStep: 'update_verification',
    isDemo: true,
    demoType: 'smooth',
    tunerMessage: '张明2026巡回演唱会周边应援棒备货500支，四城联动发放',
    groupJietlong: '排练群接龙确认：北京站150支，上海站150支，广州站100支，深圳站100支',
    hasSupplementary: false,
    verificationOrder: {
      id: 'ver-demo-001',
      orderNo: 'HX-2026-0601-001',
      recordId: 'demo-001',
      quantity: 500,
      amount: 25000,
      status: 'matched',
      createdAt: '2026-06-01 14:30:00'
    },
    operationLogs: [
      {
        id: 'log-001-1',
        timestamp: '2026-06-01 10:00:00',
        operator: '调音师-老王',
        action: '导入留言',
        description: '提交调音师留言：张明演唱会应援棒500支，四城联动',
        step: 'import'
      },
      {
        id: 'log-001-2',
        timestamp: '2026-06-01 10:05:00',
        operator: '系统',
        action: '地区校验',
        description: '授权地区校验通过：北京、上海、广州、深圳四城完整',
        step: 'import'
      },
      {
        id: 'log-001-3',
        timestamp: '2026-06-01 11:20:00',
        operator: '巡演统筹-阿梅',
        action: '补看接龙',
        description: '查看排练群接龙，确认各城市分配数量无误',
        step: 'review_jietlong'
      },
      {
        id: 'log-001-4',
        timestamp: '2026-06-01 14:30:00',
        operator: '系统',
        action: '生成核销单',
        description: '课时核销单 HX-2026-0601-001 已生成，数量500支，金额25000元',
        step: 'update_verification'
      }
    ],
    createdAt: '2026-06-01 10:00:00',
    updatedAt: '2026-06-01 14:30:00'
  },
  {
    id: 'demo-002',
    artistName: '李华巡演',
    merchandise: '巡演T恤',
    quantity: 800,
    authorizedRegions: [
      { city: '北京' },
      { city: '上海' },
      { city: '广州' },
      { city: '深圳', isMissing: true }
    ],
    status: 'pending_review',
    currentStep: 'import',
    isDemo: true,
    demoType: 'missing_region',
    tunerMessage: '李华2026全国巡演T恤备货800件，北京上海广州三城发放',
    hasSupplementary: false,
    operationLogs: [
      {
        id: 'log-002-1',
        timestamp: '2026-06-02 09:15:00',
        operator: '调音师-小张',
        action: '导入留言',
        description: '提交调音师留言：李华巡演T恤800件，北京、上海、广州',
        step: 'import'
      },
      {
        id: 'log-002-2',
        timestamp: '2026-06-02 09:16:00',
        operator: '系统',
        action: '地区校验',
        description: '检测到授权地区异常：缺少深圳站。标准巡演应覆盖四城，请店长复核补充',
        step: 'import'
      }
    ],
    createdAt: '2026-06-02 09:15:00',
    updatedAt: '2026-06-02 09:16:00'
  },
  {
    id: 'demo-003',
    artistName: '王芳音乐节',
    merchandise: '纪念手幅',
    quantity: 1200,
    authorizedRegions: [
      { city: '北京' },
      { city: '上海' },
      { city: '成都' },
      { city: '武汉' }
    ],
    status: 'supplementary',
    currentStep: 'review_jietlong',
    isDemo: true,
    demoType: 'supplementary',
    tunerMessage: '王芳音乐节纪念手幅，按新口径统计1200条',
    groupJietlong: '排练群接龙补充：旧口径统计需要追加300条VIP专属手幅',
    hasSupplementary: true,
    supplementaryNote: '旧口径VIP手幅300条未计入初始统计，需补录',
    verificationOrder: {
      id: 'ver-demo-003',
      orderNo: 'HX-2026-0603-001',
      recordId: 'demo-003',
      quantity: 1200,
      amount: 18000,
      status: 'mismatch',
      mismatchReason: '补录300条VIP手幅后，核销单数量待更新',
      createdAt: '2026-06-03 10:00:00'
    },
    operationLogs: [
      {
        id: 'log-003-1',
        timestamp: '2026-06-03 08:30:00',
        operator: '调音师-老李',
        action: '导入留言',
        description: '提交调音师留言：王芳音乐节手幅1200条，按新口径统计',
        step: 'import'
      },
      {
        id: 'log-003-2',
        timestamp: '2026-06-03 08:35:00',
        operator: '系统',
        action: '地区校验',
        description: '授权地区校验通过：北京、上海、成都、武汉',
        step: 'import'
      },
      {
        id: 'log-003-3',
        timestamp: '2026-06-03 10:00:00',
        operator: '系统',
        action: '生成核销单',
        description: '初始核销单 HX-2026-0603-001 生成，数量1200条',
        step: 'update_verification'
      },
      {
        id: 'log-003-4',
        timestamp: '2026-06-03 15:40:00',
        operator: '巡演统筹-阿梅',
        action: '标记补录返工',
        description: '排练群接龙发现旧口径VIP手幅300条，需补录返工',
        step: 'review_jietlong'
      },
      {
        id: 'log-003-5',
        timestamp: '2026-06-03 16:00:00',
        operator: '巡演统筹-阿梅',
        action: '人工修正',
        description: '追加VIP手幅300条，总量调整为1500条，待重跑校验',
        step: 'review_jietlong'
      }
    ],
    createdAt: '2026-06-03 08:30:00',
    updatedAt: '2026-06-03 16:00:00'
  }
];

export const demoExplanations = {
  smooth: {
    title: '顺利记录',
    subtitle: '标准流程：一次通过',
    steps: [
      '调音师导入完整留言信息',
      '系统自动校验授权地区，四城齐全',
      '巡演统筹补看排练群接龙，确认数量分配',
      '系统生成课时核销单，流程顺利完成'
    ],
    keyPoint: '数据完整、口径一致时，三步流程可快速完成'
  },
  missing_region: {
    title: '授权地区少写城市',
    subtitle: '异常流程：待店长复核',
    steps: [
      '调音师导入留言时遗漏深圳站',
      '系统检测到地区不完整，自动标记"待店长复核"',
      '不进入下一步，等待店长确认补充深圳',
      '店长补充后，流程继续'
    ],
    keyPoint: '关键信息缺失时绝不轻易放过，强制留痕待复核'
  },
  supplementary: {
    title: '补录旧口径',
    subtitle: '返工流程：补录+重跑',
    steps: [
      '初始记录按新口径完成核销',
      '排练群接龙出现旧口径VIP手幅信息',
      '巡演统筹标记"补录返工"，记录差异原因',
      '人工修正数量后重跑校验',
      '更新核销单，全程留痕可追溯'
    ],
    keyPoint: '返工不可怕，怕的是没人知道为什么返工'
  }
};
