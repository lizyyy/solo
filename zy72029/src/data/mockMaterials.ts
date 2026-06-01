import type { MaterialPack, Material, GameSlot } from '@/types'

export const mockSlots: GameSlot[] = [
  {
    id: 'identity',
    label: '身份证明',
    description: '用于确认被保险人身份的材料',
    acceptedCategories: ['identity'],
  },
  {
    id: 'policy',
    label: '保单信息',
    description: '保险合同及相关凭证',
    acceptedCategories: ['policy'],
  },
  {
    id: 'accident',
    label: '事故证明',
    description: '证明保险事故发生的材料',
    acceptedCategories: ['accident'],
  },
  {
    id: 'medical',
    label: '费用证明',
    description: '医疗费用、维修费用等凭证',
    acceptedCategories: ['medical', 'other'],
  },
  {
    id: 'other',
    label: '其他材料',
    description: '银行流水、授权书等辅助材料',
    acceptedCategories: ['other', 'identity'],
  },
]

export const mockMaterials: Material[] = [
  {
    id: 'mat-001',
    title: '居民身份证',
    content: '姓名：张三，身份证号：110101199001011234',
    category: 'identity',
    correctSlot: 'identity',
    sourceOrigin: '2024年车险理赔案例包-第3号',
    originalNote: '学生备注：这个好像是身份证？不对再换',
  },
  {
    id: 'mat-002',
    title: '机动车商业保险单',
    content: '保单号：202411010000123，被保险人：张三，保险期间：2024.01.01-2024.12.31',
    category: 'policy',
    correctSlot: 'policy',
    sourceOrigin: '2024年车险理赔案例包-第3号',
    originalNote: '保单正本，车损险保额20万',
  },
  {
    id: 'mat-003',
    title: '道路交通事故认定书',
    content: '事故时间：2024年3月15日，地点：朝阳区建国路，甲方：张三（全责）',
    category: 'accident',
    correctSlot: 'accident',
    sourceOrigin: '2024年车险理赔案例包-第3号',
    originalNote: '交警认定书，对方无责，注意要原件',
  },
  {
    id: 'mat-004',
    title: '汽车维修发票',
    content: '开票日期：2024-03-20，金额：￥28,500.00，维修项目：前保险杠、大灯、引擎盖',
    category: 'medical',
    correctSlot: 'medical',
    sourceOrigin: '2024年车险理赔案例包-第3号',
    originalNote: '4S店发票，价税合计，有维修清单附后',
  },
  {
    id: 'mat-005',
    title: '机动车驾驶证',
    content: '姓名：张三，准驾车型：C1，有效期：2020-2030',
    category: 'identity',
    correctSlot: 'other',
    sourceOrigin: '2024年车险理赔案例包-第3号',
    originalNote: '司机驾照，这个应该放哪里？',
  },
  {
    id: 'mat-006',
    title: '机动车行驶证',
    content: '号牌号码：京A12345，车辆类型：小型轿车，所有人：张三',
    category: 'identity',
    correctSlot: 'identity',
    sourceOrigin: '2024年车险理赔案例包-第3号',
    originalNote: '车辆行驶证，和身份证放一起？',
  },
  {
    id: 'mat-007',
    title: '银行流水',
    content: '账户：张三（尾号8888），2024年1-3月流水，显示保费缴纳记录',
    category: 'other',
    correctSlot: 'other',
    sourceOrigin: '2024年车险理赔案例包-第3号',
    originalNote: '学生瞎写的备注：这个好像没用，随便放吧',
  },
  {
    id: 'mat-008',
    title: '人身伤害医疗发票',
    content: '患者：李四（对方伤者），日期：2024-03-16，金额：￥3,200.00',
    category: 'medical',
    correctSlot: 'medical',
    sourceOrigin: '2024年车险理赔案例包-第3号',
    originalNote: '对方人员受伤的医疗费，注意是三者险赔付',
  },
]

export const mockMaterialPack: MaterialPack = {
  id: 'pack-2024-003',
  name: '2024年车险理赔练习小包（张三撞车案）',
  source: '科普馆保险教学案例库-2024春季',
  createdAt: '2024-02-15T10:30:00Z',
  createdBy: '科普馆讲解员-小夏',
  materials: mockMaterials,
  slots: mockSlots,
}

export const presetMistakeOperations = [
  {
    timestamp: new Date(Date.now() - 300000).toISOString(),
    operationType: 'place' as const,
    materialId: 'mat-005',
    targetSlot: 'identity',
    isCorrect: false,
    rawNote: '【新手误操作】把驾驶证当成纯身份证明了，忽略了"其他"槽位也接收身份类材料',
    scoreDelta: -5,
    riskDelta: 8,
    resourceDelta: 0,
  },
  {
    timestamp: new Date(Date.now() - 240000).toISOString(),
    operationType: 'click' as const,
    materialId: 'mat-007',
    rawNote: '【新手误操作】反复点击银行流水，不确定该放哪，材料都要看花了',
    scoreDelta: 0,
    riskDelta: 2,
    resourceDelta: -1,
  },
]

export const presetPauseRecord = {
  pauseTime: new Date(Date.now() - 180000).toISOString(),
  reason: '【故意打断】课堂练习暂停，小夏老师讲解要点：注意区分"身份证明"和"其他材料"的边界',
  isIntentional: true,
}

export const boundaryScoreConfig = {
  passScore: 50,
  excellentScore: 80,
  boundaryHint: '【边界分数提示】本次练习设置50分及格线，刚好卡在50分也视为通过，但会标记为"风险通过"',
}
