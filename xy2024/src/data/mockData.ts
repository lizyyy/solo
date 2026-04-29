import { v4 as uuidv4 } from 'uuid';
import { Question, ReviewRecord, ReviewSettings, MindMap, User, Subject } from '../types';

export const subjects: Subject[] = ['语文', '数学', '英语', '生物', '地理', '物理', '化学', '历史', '政治'];

export const subjectColors: Record<Subject, string> = {
  '语文': '#E74C3C',
  '数学': '#3498DB',
  '英语': '#2ECC71',
  '生物': '#9B59B6',
  '地理': '#F39C12',
  '物理': '#1ABC9C',
  '化学': '#E67E22',
  '历史': '#34495E',
  '政治': '#16A085'
};

export const mockQuestions: Question[] = [
  {
    id: uuidv4(),
    subject: '语文',
    content: '《离骚》的作者是____，他是战国时期____国人。',
    blanks: [
      { id: uuidv4(), position: 0, length: 2, answer: '屈原', hint: '伟大的爱国诗人' },
      { id: uuidv4(), position: 1, length: 1, answer: '楚', hint: '战国七雄之一' }
    ],
    answer: '《离骚》的作者是屈原，他是战国时期楚国人。',
    explanation: '屈原，芈姓，屈氏，名平，字原，是中国历史上第一位伟大的爱国诗人。',
    tags: ['古代文学', '楚辞', '战国'],
    createdAt: new Date('2024-01-15').toISOString(),
    updatedAt: new Date('2024-01-15').toISOString()
  },
  {
    id: uuidv4(),
    subject: '数学',
    content: '函数 f(x) = x² 的导数 f\'(x) = ____，二阶导数 f\'\'(x) = ____。',
    blanks: [
      { id: uuidv4(), position: 0, length: 3, answer: '2x', hint: '幂函数求导公式' },
      { id: uuidv4(), position: 1, length: 1, answer: '2', hint: '常数的导数' }
    ],
    answer: '函数 f(x) = x² 的导数 f\'(x) = 2x，二阶导数 f\'\'(x) = 2。',
    explanation: '根据幂函数求导公式：(xⁿ)\' = nxⁿ⁻¹',
    tags: ['微积分', '导数', '幂函数'],
    createdAt: new Date('2024-01-16').toISOString(),
    updatedAt: new Date('2024-01-16').toISOString()
  },
  {
    id: uuidv4(),
    subject: '英语',
    content: 'The past tense of "go" is ____，and the past participle is ____。',
    blanks: [
      { id: uuidv4(), position: 0, length: 4, answer: 'went', hint: '过去式' },
      { id: uuidv4(), position: 1, length: 5, answer: 'gone', hint: '过去分词' }
    ],
    answer: 'The past tense of "go" is went，and the past participle is gone。',
    explanation: '不规则动词变化：go - went - gone',
    tags: ['动词时态', '不规则动词'],
    createdAt: new Date('2024-01-17').toISOString(),
    updatedAt: new Date('2024-01-17').toISOString()
  },
  {
    id: uuidv4(),
    subject: '物理',
    content: '牛顿第二定律的公式是 F = ____，其中 F 是____，m 是____，a 是____。',
    blanks: [
      { id: uuidv4(), position: 0, length: 2, answer: 'ma', hint: '质量乘加速度' },
      { id: uuidv4(), position: 1, length: 2, answer: '力', hint: '物理量' },
      { id: uuidv4(), position: 2, length: 2, answer: '质量', hint: '物体的属性' },
      { id: uuidv4(), position: 3, length: 3, answer: '加速度', hint: '速度变化率' }
    ],
    answer: '牛顿第二定律的公式是 F = ma，其中 F 是力，m 是质量，a 是加速度。',
    explanation: '物体加速度的大小跟作用力成正比，跟物体的质量成反比，且与物体质量的倒数成正比。',
    tags: ['力学', '牛顿定律'],
    createdAt: new Date('2024-01-18').toISOString(),
    updatedAt: new Date('2024-01-18').toISOString()
  },
  {
    id: uuidv4(),
    subject: '化学',
    content: '水的化学式是____，相对分子质量是____，它由____元素和____元素组成。',
    blanks: [
      { id: uuidv4(), position: 0, length: 3, answer: 'H₂O', hint: '化学符号' },
      { id: uuidv4(), position: 1, length: 2, answer: '18', hint: 'H=1, O=16' },
      { id: uuidv4(), position: 2, length: 1, answer: '氢', hint: '气体元素' },
      { id: uuidv4(), position: 3, length: 1, answer: '氧', hint: '助燃气体' }
    ],
    answer: '水的化学式是H₂O，相对分子质量是18，它由氢元素和氧元素组成。',
    explanation: '水是由氢、氧两种元素组成的无机物，无毒，可饮用。',
    tags: ['化学基础', '化学式'],
    createdAt: new Date('2024-01-19').toISOString(),
    updatedAt: new Date('2024-01-19').toISOString()
  },
  {
    id: uuidv4(),
    subject: '生物',
    content: '细胞的基本结构包括____、____和____，其中____是遗传信息库。',
    blanks: [
      { id: uuidv4(), position: 0, length: 4, answer: '细胞膜', hint: '外层结构' },
      { id: uuidv4(), position: 1, length: 4, answer: '细胞质', hint: '内部液体' },
      { id: uuidv4(), position: 2, length: 3, answer: '细胞核', hint: '控制中心' },
      { id: uuidv4(), position: 3, length: 3, answer: '细胞核', hint: '含DNA' }
    ],
    answer: '细胞的基本结构包括细胞膜、细胞质和细胞核，其中细胞核是遗传信息库。',
    explanation: '细胞核是真核细胞内最大、最重要的细胞器，是细胞遗传与代谢的调控中心。',
    tags: ['细胞生物学', '细胞结构'],
    createdAt: new Date('2024-01-20').toISOString(),
    updatedAt: new Date('2024-01-20').toISOString()
  },
  {
    id: uuidv4(),
    subject: '历史',
    content: '秦始皇于公元前____年统一中国，建立了中国历史上第一个统一的____制封建国家。',
    blanks: [
      { id: uuidv4(), position: 0, length: 4, answer: '221', hint: '公元前' },
      { id: uuidv4(), position: 1, length: 2, answer: '中央', hint: '集权制度' }
    ],
    answer: '秦始皇于公元前221年统一中国，建立了中国历史上第一个统一的中央制封建国家。',
    explanation: '秦始皇嬴政，中国历史上第一位使用"皇帝"称号的君主。',
    tags: ['中国古代史', '秦朝'],
    createdAt: new Date('2024-01-21').toISOString(),
    updatedAt: new Date('2024-01-21').toISOString()
  },
  {
    id: uuidv4(),
    subject: '地理',
    content: '中国的首都是____，位于____平原，属于____气候。',
    blanks: [
      { id: uuidv4(), position: 0, length: 2, answer: '北京', hint: '直辖市' },
      { id: uuidv4(), position: 1, length: 3, answer: '华北', hint: '北方平原' },
      { id: uuidv4(), position: 2, length: 4, answer: '温带季风', hint: '夏季高温多雨' }
    ],
    answer: '中国的首都是北京，位于华北平原，属于温带季风气候。',
    explanation: '北京是中华人民共和国的首都，是全国的政治中心、文化中心。',
    tags: ['中国地理', '城市'],
    createdAt: new Date('2024-01-22').toISOString(),
    updatedAt: new Date('2024-01-22').toISOString()
  },
  {
    id: uuidv4(),
    subject: '政治',
    content: '我国的根本政治制度是____制度，我国的政体是____。',
    blanks: [
      { id: uuidv4(), position: 0, length: 4, answer: '人民代表大会', hint: '根本制度' },
      { id: uuidv4(), position: 1, length: 6, answer: '人民代表大会制度', hint: '政权组织形式' }
    ],
    answer: '我国的根本政治制度是人民代表大会制度，我国的政体是人民代表大会制度。',
    explanation: '人民代表大会制度是中国人民民主专政政权的组织形式，是我国的根本政治制度。',
    tags: ['政治制度', '宪法'],
    createdAt: new Date('2024-01-23').toISOString(),
    updatedAt: new Date('2024-01-23').toISOString()
  }
];

export const mockReviewRecords: ReviewRecord[] = mockQuestions.slice(0, 4).map((q, index) => ({
  id: uuidv4(),
  questionId: q.id,
  familiarity: index % 3 === 0 ? '认识' : index % 3 === 1 ? '模糊' : '忘记',
  reviewedAt: new Date('2024-04-20').toISOString(),
  nextReviewDate: new Date('2024-04-27').toISOString(),
  reviewCount: index + 1,
  easeFactor: 2.5,
  interval: index === 0 ? 1 : index === 1 ? 2 : 4
}));

export const mockReviewSettings: ReviewSettings = {
  id: uuidv4(),
  userId: 'user-1',
  algorithm: 'ebbinghaus',
  customIntervals: [1, 2, 4, 7, 15, 30, 60],
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString()
};

export const mockMindMaps: MindMap[] = [
  {
    id: uuidv4(),
    title: '数学知识体系',
    type: 'tree',
    root: {
      id: uuidv4(),
      label: '高中数学',
      type: 'root',
      questionIds: [],
      children: [
        {
          id: uuidv4(),
          label: '代数',
          type: 'branch',
          questionIds: [mockQuestions[1].id],
          children: [
            {
              id: uuidv4(),
              label: '函数',
              type: 'leaf',
              questionIds: [mockQuestions[1].id],
              children: []
            },
            {
              id: uuidv4(),
              label: '数列',
              type: 'leaf',
              questionIds: [],
              children: []
            }
          ]
        },
        {
          id: uuidv4(),
          label: '几何',
          type: 'branch',
          questionIds: [],
          children: [
            {
              id: uuidv4(),
              label: '立体几何',
              type: 'leaf',
              questionIds: [],
              children: []
            },
            {
              id: uuidv4(),
              label: '解析几何',
              type: 'leaf',
              questionIds: [],
              children: []
            }
          ]
        }
      ]
    },
    createdAt: new Date('2024-01-10').toISOString(),
    updatedAt: new Date('2024-01-10').toISOString()
  }
];

export const mockUser: User = {
  id: 'user-1',
  name: '学习者',
  avatar: undefined,
  totalQuestions: mockQuestions.length,
  reviewedQuestions: 4,
  streakDays: 7,
  createdAt: new Date('2024-01-01').toISOString()
};
