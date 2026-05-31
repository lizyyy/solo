import { Record, MaterialPack } from '@/types';

export const mockRecords: Record[] = [
  {
    id: 'r001',
    studentId: 's001',
    studentName: '张三',
    questionId: 'q001',
    questionTitle: '求函数 f(x) = x² - 2x + 1 的最小值',
    knowledgePoint: '二次函数最值',
    studentAnswer: '当x=1时，最小值为0',
    standardAnswer: '当x=1时，最小值为0',
    score: 5,
    fullScore: 5,
    source: 'normal',
    isDuplicate: false,
    attachments: [
      {
        id: 'a001',
        type: 'screenshot',
        name: '错题截图1.png',
        url: 'https://picsum.photos/400/300?random=1',
        isLate: false,
        timestamp: '2024-01-15 09:30:00'
      }
    ],
    corrections: [],
    createdAt: '2024-01-15 09:30:00'
  },
  {
    id: 'r002',
    studentId: 's002',
    studentName: '李四',
    questionId: 'q001',
    questionTitle: '求函数 f(x) = x² - 2x + 1 的最小值',
    knowledgePoint: '二次函数最值',
    studentAnswer: 'x=1, f(x)=0',
    standardAnswer: '当x=1时，最小值为0',
    score: 4,
    fullScore: 5,
    source: 'normal',
    isDuplicate: false,
    attachments: [],
    corrections: [],
    createdAt: '2024-01-15 09:35:00'
  },
  {
    id: 'r003',
    studentId: 's003',
    studentName: '王五',
    questionId: 'q002',
    questionTitle: '解不等式 x² - 4 > 0',
    knowledgePoint: '一元二次不等式',
    studentAnswer: 'x > 2 或 x < -2',
    standardAnswer: 'x ∈ (-∞, -2) ∪ (2, +∞)',
    score: 3,
    fullScore: 5,
    source: 'late',
    isDuplicate: false,
    attachments: [
      {
        id: 'a002',
        type: 'image',
        name: '讲义截图.png',
        url: 'https://picsum.photos/400/300?random=2',
        isLate: true,
        timestamp: '2024-01-15 14:20:00'
      }
    ],
    corrections: [
      {
        id: 'c001',
        recordId: 'r003',
        field: 'score',
        before: 2,
        after: 3,
        operator: '李老师',
        reason: '补充分步得分',
        timestamp: '2024-01-15 15:00:00'
      }
    ],
    createdAt: '2024-01-15 14:20:00'
  },
  {
    id: 'r004',
    studentId: 's001',
    studentName: '张三',
    questionId: 'q003',
    questionTitle: '求集合 A = {x | x² = 0} 的元素个数',
    knowledgePoint: '集合概念',
    studentAnswer: '空集，0个元素',
    standardAnswer: '{0}，1个元素',
    score: 0,
    fullScore: 3,
    source: 'normal',
    isDuplicate: false,
    attachments: [],
    corrections: [],
    createdAt: '2024-01-15 10:00:00'
  },
  {
    id: 'r005',
    studentId: 's002',
    studentName: '李四',
    questionId: 'q003',
    questionTitle: '求集合 A = {x | x² = 0} 的元素个数',
    knowledgePoint: '集合概念',
    studentAnswer: '{0}',
    standardAnswer: '{0}，1个元素',
    score: 3,
    fullScore: 3,
    source: 'normal',
    isDuplicate: true,
    duplicateOf: 'r004',
    attachments: [],
    corrections: [],
    createdAt: '2024-01-15 10:05:00'
  },
  {
    id: 'r006',
    studentId: 's004',
    studentName: '赵六',
    questionId: 'q002',
    questionTitle: '解不等式 x² - 4 > 0',
    knowledgePoint: '一元二次不等式',
    studentAnswer: 'x > 2',
    standardAnswer: 'x ∈ (-∞, -2) ∪ (2, +∞)',
    score: 2,
    fullScore: 5,
    source: 'correction',
    isDuplicate: false,
    attachments: [],
    corrections: [
      {
        id: 'c002',
        recordId: 'r006',
        field: 'score',
        before: 1,
        after: 2,
        operator: '王老师',
        reason: '分步给分',
        timestamp: '2024-01-15 16:00:00'
      }
    ],
    createdAt: '2024-01-15 11:00:00'
  },
  {
    id: 'r007',
    studentId: 's005',
    studentName: '孙七',
    questionId: 'q004',
    questionTitle: '求函数 y = sin(x) 的定义域',
    knowledgePoint: '三角函数定义域',
    studentAnswer: 'x ∈ [0, 2π]',
    standardAnswer: 'x ∈ R',
    score: 1,
    fullScore: 4,
    source: 'normal',
    isDuplicate: false,
    attachments: [
      {
        id: 'a003',
        type: 'screenshot',
        name: '学生作业.png',
        url: 'https://picsum.photos/400/300?random=3',
        isLate: false,
        timestamp: '2024-01-15 11:30:00'
      }
    ],
    corrections: [],
    createdAt: '2024-01-15 11:30:00'
  },
  {
    id: 'r008',
    studentId: 's003',
    studentName: '王五',
    questionId: 'q005',
    questionTitle: '求函数 y = 1/x 的定义域',
    knowledgePoint: '函数定义域',
    studentAnswer: 'x ≠ 0 且 x ∈ R',
    standardAnswer: 'x ∈ (-∞, 0) ∪ (0, +∞)',
    score: 3,
    fullScore: 4,
    source: 'late',
    isDuplicate: false,
    attachments: [
      {
        id: 'a004',
        type: 'image',
        name: '补充附件.png',
        url: 'https://picsum.photos/400/300?random=4',
        isLate: true,
        timestamp: '2024-01-15 18:00:00'
      }
    ],
    corrections: [],
    createdAt: '2024-01-15 12:00:00'
  }
];

export const mockMaterialPack: MaterialPack = {
  id: 'pack001',
  name: '周测错题包 v1',
  records: mockRecords,
  version: 1,
  createdAt: '2024-01-15 09:00:00'
};

export const mockMaterialPackV2: MaterialPack = {
  id: 'pack001',
  name: '周测错题包 v2',
  records: [
    ...mockRecords.slice(0, 6),
    {
      ...mockRecords[6],
      score: 2
    },
    mockRecords[7]
  ],
  version: 2,
  createdAt: '2024-01-16 10:00:00'
};

export const knowledgePoints = [
  '二次函数最值',
  '一元二次不等式',
  '集合概念',
  '三角函数定义域',
  '函数定义域'
];

export const errorTypes = [
  '概念误解',
  '计算错误',
  '步骤遗漏',
  '表达不规范',
  '答案不完整'
];
