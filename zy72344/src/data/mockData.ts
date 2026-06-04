import type { ParameterTable, StudentAnswer, HistoryRecord, MealPlanResult, VisualizationData } from '@/types';

export const mockParameterTables: ParameterTable[] = [
  {
    id: 'param-001',
    name: '第一季度配餐参数表',
    version: 'v1.0',
    importedAt: '2026-06-01 09:30:00',
    importedBy: '吴老师',
    hash: 'hash-abc123',
    records: [
      { id: 'r1', name: '蛋白质需求', value: 65, constraint: '>= 50' },
      { id: 'r2', name: '热量上限', value: 2000, constraint: '<= 2500' },
      { id: 'r3', name: '脂肪占比', value: 25, constraint: '20-30%' },
    ],
  },
  {
    id: 'param-002',
    name: '第二季度配餐参数表',
    version: 'v1.1',
    importedAt: '2026-06-03 14:20:00',
    importedBy: '吴老师',
    hash: 'hash-def456',
    records: [
      { id: 'r4', name: '蛋白质需求', value: 70, constraint: '>= 55' },
      { id: 'r5', name: '热量上限', value: 2200, constraint: '<= 2600' },
      { id: 'r6', name: '脂肪占比', value: 28, constraint: '22-32%' },
    ],
  },
];

export const mockStudentAnswers: StudentAnswer[] = [
  {
    id: 'ans-001',
    studentId: 'stu-001',
    studentName: '张三',
    version: 1,
    content: '解法一：使用拉格朗日乘子法，设L = f(x,y) - λ(g(x,y)-c)...',
    status: 'exception',
    remark: '初始答案，待复核',
    createdAt: '2026-06-02 10:00:00',
  },
  {
    id: 'ans-002',
    studentId: 'stu-001',
    studentName: '张三',
    version: 2,
    content: '解法二：修正了约束条件，重新计算偏导数...',
    status: 'reviewing',
    remark: '同一学生提交第二版答案，留待运营复核',
    createdAt: '2026-06-02 15:30:00',
    manualExample: '手算验证：当x=5,y=3时，f=34，满足约束g=8',
  },
  {
    id: 'ans-003',
    studentId: 'stu-002',
    studentName: '李四',
    version: 1,
    content: '标准解法，步骤完整，答案正确',
    status: 'normal',
    remark: '答案正确',
    createdAt: '2026-06-02 11:20:00',
  },
  {
    id: 'ans-004',
    studentId: 'stu-003',
    studentName: '王五',
    version: 1,
    content: '计算过程存在符号错误',
    status: 'pending',
    remark: '待审核',
    createdAt: '2026-06-03 09:15:00',
  },
];

export const mockHistoryRecords: HistoryRecord[] = [
  {
    id: 'hist-001',
    targetId: 'ans-002',
    targetType: 'answer',
    fieldName: 'remark',
    oldValue: '初始答案',
    newValue: '同一学生提交第二版答案，留待运营复核',
    operator: '吴老师',
    operatedAt: '2026-06-02 16:00:00',
  },
  {
    id: 'hist-002',
    targetId: 'ans-002',
    targetType: 'answer',
    fieldName: 'status',
    oldValue: 'pending',
    newValue: 'reviewing',
    operator: '吴老师',
    operatedAt: '2026-06-02 16:00:00',
  },
  {
    id: 'hist-003',
    targetId: 'ans-002',
    targetType: 'answer',
    fieldName: 'manualExample',
    oldValue: '',
    newValue: '手算验证：当x=5,y=3时，f=34，满足约束g=8',
    operator: '吴老师',
    operatedAt: '2026-06-03 10:00:00',
  },
];

export const mockMealPlanResults: MealPlanResult[] = [
  {
    id: 'meal-001',
    parameterVersion: 'v1.0',
    calculationReason: '使用拉格朗日乘子法求解约束优化问题，K=0.618，取α=0.05置信水平',
    result: {
      '主食分配': 45,
      '蛋白质来源': 30,
      '蔬菜配比': 25,
    },
    errors: [
      {
        id: 'err-001',
        description: '张三的两版答案存在矛盾，v1版本计算错误',
        reason: 'v1版本在计算偏导数时符号错误，v2版本修正后结果与手算验证一致',
        missingMaterials: ['原始试卷扫描件', '课堂笔记'],
        nextStep: 'research',
        kept: true,
      },
      {
        id: 'err-002',
        description: '王五的答案缺少关键步骤说明',
        reason: '计算结果正确，但未说明拉格朗日乘子的物理意义',
        missingMaterials: ['解题过程详细说明'],
        nextStep: 'business',
        kept: true,
      },
    ],
    createdAt: '2026-06-04 08:00:00',
  },
];

export const mockVisualizationData: VisualizationData[] = [
  { x: 1, y: 2, z: 3, answerId: 'ans-001', studentName: '张三(v1)', value: 85 },
  { x: 2, y: 3, z: 4, answerId: 'ans-002', studentName: '张三(v2)', value: 92 },
  { x: 3, y: 1, z: 2, answerId: 'ans-003', studentName: '李四', value: 95 },
  { x: 4, y: 2, z: 1, answerId: 'ans-004', studentName: '王五', value: 78 },
];
