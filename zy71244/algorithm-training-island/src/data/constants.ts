import type { KnowledgePoint, Member, Problem, Contest, GameConfig } from '../types';

export const KNOWLEDGE_POINTS: KnowledgePoint[] = [
  'dp',
  'graph',
  'string',
  'math',
  'geometry',
  'dataStructure',
  'greedy',
  'search',
];

export const KNOWLEDGE_POINT_NAMES: Record<KnowledgePoint, string> = {
  dp: '动态规划',
  graph: '图论',
  string: '字符串',
  math: '数学',
  geometry: '几何',
  dataStructure: '数据结构',
  greedy: '贪心',
  search: '搜索',
};

export const KNOWLEDGE_POINT_COLORS: Record<KnowledgePoint, string> = {
  dp: 'from-blue-500 to-cyan-500',
  graph: 'from-green-500 to-emerald-500',
  string: 'from-yellow-500 to-orange-500',
  math: 'from-red-500 to-pink-500',
  geometry: 'from-purple-500 to-violet-500',
  dataStructure: 'from-indigo-500 to-blue-500',
  greedy: 'from-teal-500 to-green-500',
  search: 'from-rose-500 to-red-500',
};

export const ACTIVITY_NAMES = {
  practice: '刷题',
  review: '复盘',
  rest: '休息',
};

export const ACTIVITY_COLORS = {
  practice: 'bg-blue-600',
  review: 'bg-purple-600',
  rest: 'bg-green-600',
};

export const DIFFICULTY_NAMES = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export const DIFFICULTY_COLORS = {
  easy: 'text-green-400',
  medium: 'text-yellow-400',
  hard: 'text-red-400',
};

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'member-1',
    name: '小明',
    avatar: '👨‍💻',
    overallAbility: 60,
    fatigue: 0,
    maxFatigue: 100,
    knowledgePoints: {
      dp: 50,
      graph: 55,
      string: 65,
      math: 70,
      geometry: 40,
      dataStructure: 60,
      greedy: 55,
      search: 50,
    },
    traits: ['快速学习', '容易疲劳'],
    consecutivePracticeDays: 0,
    consecutiveRestDays: 0,
    lastActivity: null,
    reviewCount: 0,
    practiceCount: 0,
    crashCount: 0,
  },
  {
    id: 'member-2',
    name: '小红',
    avatar: '👩‍💻',
    overallAbility: 65,
    fatigue: 0,
    maxFatigue: 120,
    knowledgePoints: {
      dp: 70,
      graph: 60,
      string: 55,
      math: 50,
      geometry: 65,
      dataStructure: 55,
      greedy: 70,
      search: 60,
    },
    traits: ['坚持不懈', '几何高手'],
    consecutivePracticeDays: 0,
    consecutiveRestDays: 0,
    lastActivity: null,
    reviewCount: 0,
    practiceCount: 0,
    crashCount: 0,
  },
  {
    id: 'member-3',
    name: '小刚',
    avatar: '🧑‍💻',
    overallAbility: 55,
    fatigue: 0,
    maxFatigue: 150,
    knowledgePoints: {
      dp: 45,
      graph: 70,
      string: 50,
      math: 55,
      geometry: 45,
      dataStructure: 75,
      greedy: 50,
      search: 65,
    },
    traits: ['数据结构专家', '耐力强'],
    consecutivePracticeDays: 0,
    consecutiveRestDays: 0,
    lastActivity: null,
    reviewCount: 0,
    practiceCount: 0,
    crashCount: 0,
  },
];

export const INITIAL_PROBLEMS: Problem[] = [
  {
    id: 'prob-1',
    title: '爬楼梯',
    difficulty: 'easy',
    knowledgePoints: ['dp'],
    points: 10,
    version: 1,
    availableFromDay: 1,
  },
  {
    id: 'prob-2',
    title: '最短路径',
    difficulty: 'easy',
    knowledgePoints: ['graph', 'search'],
    points: 10,
    version: 1,
    availableFromDay: 1,
  },
  {
    id: 'prob-3',
    title: '字符串匹配',
    difficulty: 'easy',
    knowledgePoints: ['string'],
    points: 10,
    version: 1,
    availableFromDay: 1,
  },
  {
    id: 'prob-4',
    title: '质数筛',
    difficulty: 'easy',
    knowledgePoints: ['math'],
    points: 10,
    version: 1,
    availableFromDay: 1,
  },
  {
    id: 'prob-5',
    title: '最长递增子序列',
    difficulty: 'medium',
    knowledgePoints: ['dp', 'greedy'],
    points: 25,
    version: 1,
    availableFromDay: 2,
  },
  {
    id: 'prob-6',
    title: '最小生成树',
    difficulty: 'medium',
    knowledgePoints: ['graph', 'dataStructure'],
    points: 25,
    version: 1,
    availableFromDay: 2,
  },
  {
    id: 'prob-7',
    title: '线段树区间查询',
    difficulty: 'medium',
    knowledgePoints: ['dataStructure'],
    points: 25,
    version: 1,
    availableFromDay: 3,
  },
  {
    id: 'prob-8',
    title: '背包问题变种',
    difficulty: 'medium',
    knowledgePoints: ['dp'],
    points: 25,
    version: 1,
    availableFromDay: 3,
  },
  {
    id: 'prob-9',
    title: 'AC自动机',
    difficulty: 'hard',
    knowledgePoints: ['string', 'dataStructure'],
    points: 50,
    version: 1,
    availableFromDay: 5,
  },
  {
    id: 'prob-10',
    title: '网络流最大流',
    difficulty: 'hard',
    knowledgePoints: ['graph'],
    points: 50,
    version: 1,
    availableFromDay: 5,
  },
  {
    id: 'prob-11',
    title: '数位DP',
    difficulty: 'hard',
    knowledgePoints: ['dp', 'math'],
    points: 50,
    version: 1,
    availableFromDay: 7,
  },
  {
    id: 'prob-12',
    title: '半平面交',
    difficulty: 'hard',
    knowledgePoints: ['geometry'],
    points: 50,
    version: 1,
    availableFromDay: 7,
  },
];

export const INITIAL_CONTESTS: Contest[] = [
  {
    id: 'contest-1',
    name: '周赛 #1',
    day: 5,
    problems: [
      { ...INITIAL_PROBLEMS[0], id: 'c1-p1' },
      { ...INITIAL_PROBLEMS[1], id: 'c1-p2' },
      { ...INITIAL_PROBLEMS[4], id: 'c1-p3' },
    ],
    duration: 120,
    targetScore: 40,
    version: 1,
  },
  {
    id: 'contest-2',
    name: '月赛 #1',
    day: 10,
    problems: [
      { ...INITIAL_PROBLEMS[2], id: 'c2-p1' },
      { ...INITIAL_PROBLEMS[5], id: 'c2-p2' },
      { ...INITIAL_PROBLEMS[6], id: 'c2-p3' },
      { ...INITIAL_PROBLEMS[9], id: 'c2-p4' },
    ],
    duration: 180,
    targetScore: 80,
    version: 1,
  },
  {
    id: 'contest-3',
    name: '省选模拟赛',
    day: 14,
    problems: [
      { ...INITIAL_PROBLEMS[7], id: 'c3-p1' },
      { ...INITIAL_PROBLEMS[8], id: 'c3-p2' },
      { ...INITIAL_PROBLEMS[10], id: 'c3-p3' },
      { ...INITIAL_PROBLEMS[11], id: 'c3-p4' },
    ],
    duration: 240,
    targetScore: 120,
    version: 1,
  },
];

export const DEFAULT_CONFIG: GameConfig = {
  totalDays: 14,
  contestInterval: 5,
  initialMembers: INITIAL_MEMBERS,
  initialProblems: INITIAL_PROBLEMS,
  contests: INITIAL_CONTESTS,
  targetScore: 300,
  settings: {
    fatigueRecoveryRate: 0.4,
    practiceFatigueCost: 0.25,
    reviewFatigueCost: 0.15,
    knowledgeDecayRate: 0.02,
    crashThreshold: 0.9,
  },
};

export const TRAIT_EFFECTS: Record<string, { description: string; effect: string }> = {
  '快速学习': {
    description: '学习速度提升20%',
    effect: 'practice_ability_bonus:1.2',
  },
  '容易疲劳': {
    description: '疲劳累积速度提升25%',
    effect: 'fatigue_multiplier:1.25',
  },
  '坚持不懈': {
    description: '连续刷题效率不衰减',
    effect: 'no_consecutive_penalty',
  },
  '几何高手': {
    description: '几何类题目能力+20',
    effect: 'geometry_bonus:20',
  },
  '数据结构专家': {
    description: '数据结构类题目能力+25',
    effect: 'dataStructure_bonus:25',
  },
  '耐力强': {
    description: '最大疲劳值+30%',
    effect: 'max_fatigue_multiplier:1.3',
  },
};
