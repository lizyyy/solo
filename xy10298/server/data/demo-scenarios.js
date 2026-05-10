const DEMO_SCENARIOS = [
  {
    id: 'demo_1',
    name: '2岁宝宝·语言启蒙期',
    description: '刚学会说话，家长希望提升语言能力',
    input: {
      childAge: 2,
      parentGoals: ['语言发展', '认知发展'],
      borrowingHistory: [
        { bookId: 'B001', borrowDate: '2026-05-01', rating: 5 },
        { bookId: 'B002', borrowDate: '2026-04-20', rating: 4 }
      ]
    },
    expectedOutcome: {
      ageTier: '0-2岁 婴儿期',
      keyThemes: ['认知启蒙', '亲子互动', '语言发展'],
      sampleBooks: ['好饿的毛毛虫', '猜猜我有多爱你', '逃家小兔']
    }
  },
  {
    id: 'demo_2',
    name: '4岁幼儿·社交情绪培养',
    description: '即将入园，需要社交和情绪管理能力',
    input: {
      childAge: 4,
      parentGoals: ['社交能力', '情绪管理'],
      borrowingHistory: [
        { bookId: 'B004', borrowDate: '2026-05-05', rating: 4 },
        { bookId: 'B005', borrowDate: '2026-04-28', rating: 5 },
        { bookId: 'B010', borrowDate: '2026-04-10', rating: 3 }
      ]
    },
    expectedOutcome: {
      ageTier: '3-5岁 幼儿期',
      keyThemes: ['情绪管理', '社交友谊', '生活习惯'],
      sampleBooks: ['我的情绪小怪兽', '大卫不可以', '月亮的味道']
    }
  },
  {
    id: 'demo_3',
    name: '7岁小学生·知识拓展',
    description: '刚上小学，喜欢科学和历史',
    input: {
      childAge: 7,
      parentGoals: ['知识拓展', '阅读习惯'],
      borrowingHistory: [
        { bookId: 'B011', borrowDate: '2026-05-03', rating: 5 },
        { bookId: 'B012', borrowDate: '2026-04-25', rating: 5 },
        { bookId: 'B019', borrowDate: '2026-04-15', rating: 4 }
      ]
    },
    expectedOutcome: {
      ageTier: '6-8岁 学龄初期',
      keyThemes: ['科普知识', '历史文化', '桥梁书'],
      sampleBooks: ['神奇校车', '昆虫记', '故宫里的大怪兽']
    }
  },
  {
    id: 'demo_4',
    name: '10岁少年·品格成长',
    description: '阅读能力强，需要文学和品格塑造',
    input: {
      childAge: 10,
      parentGoals: ['品格塑造', '认知发展'],
      borrowingHistory: [
        { bookId: 'B013', borrowDate: '2026-05-06', rating: 5 },
        { bookId: 'B015', borrowDate: '2026-04-20', rating: 4 },
        { bookId: 'B024', borrowDate: '2026-04-01', rating: 5 }
      ]
    },
    expectedOutcome: {
      ageTier: '9-12岁 学龄中期',
      keyThemes: ['品格塑造', '成长励志', '文学名著'],
      sampleBooks: ['夏洛的网', '草房子', '小王子']
    }
  },
  {
    id: 'demo_5',
    name: '脏数据演示·错误年龄和无效记录',
    description: '展示系统如何处理脏数据，不静默跳过',
    input: {
      childAge: '五岁',
      parentGoals: [123, '提高智商'],
      borrowingHistory: [
        { bookId: null, borrowDate: 'invalid-date' },
        { bookId: 'B999', borrowDate: '2026-05-01', rating: 10 }
      ]
    },
    expectedOutcome: {
      willHaveErrors: true,
      issueCount: '>= 3',
      issuesWillContain: ['年龄格式错误', '目标格式错误', '记录缺少书籍ID']
    }
  },
  {
    id: 'demo_6',
    name: '历史反馈演示·不喜欢情绪类',
    description: '展示低评分如何影响后续推荐',
    input: {
      childAge: 5,
      parentGoals: ['语言发展'],
      borrowingHistory: [
        { bookId: 'B005', borrowDate: '2026-05-01', rating: 1 },
        { bookId: 'B001', borrowDate: '2026-04-20', rating: 5 },
        { bookId: 'B008', borrowDate: '2026-04-10', rating: 5 }
      ]
    },
    expectedOutcome: {
      dislikedThemes: ['情绪管理', '情绪安抚'],
      penaltyApplied: true,
      avoidedBooks: ['我的情绪小怪兽']
    }
  }
];

const RULE_VERIFICATION_TESTS = [
  {
    ruleId: 'RULE_AGE_01',
    ruleName: '年龄分层规则',
    description: '不同年龄应匹配不同主题',
    testCases: [
      { age: 1, expectedThemes: ['认知启蒙', '亲子互动'] },
      { age: 4, expectedThemes: ['社交友谊', '想象力'] },
      { age: 7, expectedThemes: ['科普知识', '桥梁书'] },
      { age: 11, expectedThemes: ['成长励志', '文学名著'] }
    ]
  },
  {
    ruleId: 'RULE_GOAL_01',
    ruleName: '家长目标加权',
    description: '选择目标应提升相关主题权重',
    testCases: [
      { goal: '语言发展', boostThemes: ['故事童话', '亲子互动'], multiplier: 1.5 },
      { goal: '情绪管理', boostThemes: ['情绪管理', '情绪安抚'], multiplier: 1.8 }
    ]
  },
  {
    ruleId: 'RULE_HISTORY_01',
    ruleName: '借阅历史权重',
    description: '近期借阅主题应加权，低评分主题应降权',
    testCases: [
      { recency: '7天内', weight: 1.5 },
      { recency: '30天内', weight: 1.2 },
      { rating: '<=2', penalty: 0.5 }
    ]
  },
  {
    ruleId: 'RULE_DATA_01',
    ruleName: '脏数据处理',
    description: '无效数据应进入问题列表，保留来源',
    testCases: [
      { input: { childAge: 'abc' }, expectedError: 'AGE_INVALID_TYPE' },
      { input: { childAge: -5 }, expectedError: 'AGE_NEGATIVE' },
      { input: { borrowingHistory: [{ bookId: null }] }, expectedError: 'MISSING_BOOK_ID' }
    ]
  }
];

module.exports = {
  DEMO_SCENARIOS,
  RULE_VERIFICATION_TESTS
};
