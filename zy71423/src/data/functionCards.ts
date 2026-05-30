import { FunctionCard } from '../types';

export const functionCards: FunctionCard[] = [
  {
    id: 'linear-001',
    name: '一次函数基础',
    expression: 'f(x) = 2x + 1',
    type: 'linear',
    difficulty: 'easy',
    domain: [-10, 10],
    discontinuities: [],
    nonDifferentiablePoints: [],
    traps: [],
    description: '基础线性函数，全程可导，适合新手熟悉操作',
    fn: (x: number) => 2 * x + 1,
  },
  {
    id: 'quadratic-001',
    name: '抛物线',
    expression: 'f(x) = x² - 4',
    type: 'quadratic',
    difficulty: 'easy',
    domain: [-10, 10],
    discontinuities: [],
    nonDifferentiablePoints: [],
    traps: [],
    description: '标准二次函数，平滑曲线，无陷阱',
    fn: (x: number) => x * x - 4,
  },
  {
    id: 'piecewise-001',
    name: '分段函数-角点',
    expression: 'f(x) = |x|',
    type: 'piecewise',
    difficulty: 'medium',
    domain: [-10, 10],
    discontinuities: [],
    nonDifferentiablePoints: [0],
    traps: [
      { x: 0, type: 'corner', radius: 0.5 },
    ],
    description: '绝对值函数，在 x=0 处有角点不可导',
    fn: (x: number) => Math.abs(x),
  },
  {
    id: 'piecewise-002',
    name: '跳跃间断点',
    expression: 'f(x) = { x+1, x<0; x-1, x≥0 }',
    type: 'piecewise',
    difficulty: 'hard',
    domain: [-10, 10],
    discontinuities: [0],
    nonDifferentiablePoints: [0],
    traps: [
      { x: 0, type: 'discontinuity', radius: 0.8 },
    ],
    description: '在 x=0 处有跳跃间断点，不连续必不可导',
    fn: (x: number) => x < 0 ? x + 1 : x - 1,
  },
  {
    id: 'trigonometric-001',
    name: '正弦曲线',
    expression: 'f(x) = sin(x)',
    type: 'trigonometric',
    difficulty: 'medium',
    domain: [-6.28, 6.28],
    discontinuities: [],
    nonDifferentiablePoints: [],
    traps: [],
    description: '正弦函数，周期波动，全程可导',
    fn: (x: number) => Math.sin(x),
  },
  {
    id: 'piecewise-003',
    name: '尖点陷阱',
    expression: 'f(x) = x^(2/3)',
    type: 'piecewise',
    difficulty: 'hard',
    domain: [-10, 10],
    discontinuities: [],
    nonDifferentiablePoints: [0],
    traps: [
      { x: 0, type: 'cusp', radius: 0.6 },
    ],
    description: '在 x=0 处有尖点，左右导数均为无穷大',
    fn: (x: number) => Math.sign(x) * Math.pow(Math.abs(x), 2 / 3),
  },
  {
    id: 'piecewise-004',
    name: '多重陷阱',
    expression: 'f(x) = { x², x<-2; |x|, -2≤x≤2; x², x>2 }',
    type: 'piecewise',
    difficulty: 'hard',
    domain: [-10, 10],
    discontinuities: [],
    nonDifferentiablePoints: [-2, 0, 2],
    traps: [
      { x: -2, type: 'corner', radius: 0.5 },
      { x: 0, type: 'corner', radius: 0.5 },
      { x: 2, type: 'corner', radius: 0.5 },
    ],
    description: '三个角点陷阱，考验你的反应速度',
    fn: (x: number) => {
      if (x < -2) return x * x;
      if (x <= 2) return Math.abs(x);
      return x * x;
    },
  },
  {
    id: 'quadratic-002',
    name: '可去间断点',
    expression: 'f(x) = (x²-1)/(x-1), x≠1; 2, x=1',
    type: 'quadratic',
    difficulty: 'medium',
    domain: [-5, 5],
    discontinuities: [],
    nonDifferentiablePoints: [],
    traps: [],
    description: '看似有间断点，实际补充定义后连续可导',
    fn: (x: number) => Math.abs(x - 1) < 0.001 ? 2 : (x * x - 1) / (x - 1),
  },
  {
    id: 'trigonometric-002',
    name: '震荡函数',
    expression: 'f(x) = x*sin(1/x), x≠0; 0, x=0',
    type: 'trigonometric',
    difficulty: 'hard',
    domain: [-2, 2],
    discontinuities: [],
    nonDifferentiablePoints: [0],
    traps: [
      { x: 0, type: 'cusp', radius: 0.3 },
    ],
    description: '在 x=0 处连续但不可导，无穷震荡',
    fn: (x: number) => Math.abs(x) < 0.001 ? 0 : x * Math.sin(1 / x),
  },
  {
    id: 'piecewise-005',
    name: '垂直切线',
    expression: 'f(x) = x^(1/3)',
    type: 'piecewise',
    difficulty: 'hard',
    domain: [-10, 10],
    discontinuities: [],
    nonDifferentiablePoints: [0],
    traps: [
      { x: 0, type: 'verticalTangent', radius: 0.5 },
    ],
    description: '在 x=0 处有垂直切线，导数为无穷大',
    fn: (x: number) => Math.sign(x) * Math.pow(Math.abs(x), 1 / 3),
  },
];

export const getFunctionCardById = (id: string): FunctionCard | undefined => {
  return functionCards.find(card => card.id === id);
};

export const getFunctionCardsByType = (type: string): FunctionCard[] => {
  return functionCards.filter(card => card.type === type);
};

export const getFunctionCardsByDifficulty = (difficulty: string): FunctionCard[] => {
  return functionCards.filter(card => card.difficulty === difficulty);
};
