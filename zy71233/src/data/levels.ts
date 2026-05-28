import { Level } from '@/types';

export const levels: Level[] = [
  {
    id: 'demo-correct',
    name: '正确示范：Bell态构建',
    difficulty: 'easy',
    description: '学习如何正确构建Bell态量子电路，观察量子纠缠现象',
    qubits: 2,
    slots: 4,
    availableGates: ['H', 'X', 'CNOT'],
    targetGateSequence: [
      { qubit: 0, slot: 0, type: 'H' },
      { qubit: 0, slot: 1, type: 'CNOT' },
    ],
    targetProbabilities: {
      '00': 0.5,
      '01': 0,
      '10': 0,
      '11': 0.5,
    },
    hints: ['先对q0应用H门创建叠加态', '然后应用CNOT门创建纠缠'],
    maxScore: 100,
  },
  {
    id: 'demo-wrong',
    name: '错误示范：典型错误案例',
    difficulty: 'easy',
    description: '包含门顺序错误、概率未归一、噪声未扣除的典型错误案例',
    qubits: 2,
    slots: 5,
    availableGates: ['H', 'X', 'Z', 'CNOT', 'Measure'],
    requiredNoise: 'bit-flip',
    noiseOffsetGate: 'X',
    targetGateSequence: [
      { qubit: 0, slot: 0, type: 'H' },
      { qubit: 0, slot: 2, type: 'X' },
    ],
    targetProbabilities: {
      '00': 0.5,
      '01': 0.5,
      '10': 0,
      '11': 0,
    },
    hints: ['这是一个错误示范关卡', '观察系统如何检测各类错误'],
    maxScore: 100,
  },
  {
    id: 'level-1',
    name: '入门：叠加态创建',
    difficulty: 'easy',
    description: '使用H门创建量子叠加态，测量结果应该是50% |0⟩ 和 50% |1⟩',
    qubits: 1,
    slots: 2,
    availableGates: ['H', 'X'],
    targetGateSequence: [{ qubit: 0, slot: 0, type: 'H' }],
    targetProbabilities: {
      '0': 0.5,
      '1': 0.5,
    },
    hints: ['只需要一个H门即可创建叠加态'],
    maxScore: 100,
  },
  {
    id: 'level-2',
    name: '基础：量子NOT门',
    difficulty: 'easy',
    description: '使用X门将|0⟩翻转为|1⟩，测量结果应该100%是|1⟩',
    qubits: 1,
    slots: 2,
    availableGates: ['H', 'X', 'Z'],
    targetGateSequence: [{ qubit: 0, slot: 0, type: 'X' }],
    targetProbabilities: {
      '0': 0,
      '1': 1,
    },
    hints: ['X门相当于经典的NOT门', '它会翻转量子比特的状态'],
    maxScore: 100,
  },
  {
    id: 'level-3',
    name: '进阶：双量子比特纠缠',
    difficulty: 'medium',
    description: '使用H门和CNOT门创建Bell态，两个量子比特将产生量子纠缠',
    qubits: 2,
    slots: 4,
    availableGates: ['H', 'X', 'CNOT'],
    targetGateSequence: [
      { qubit: 0, slot: 0, type: 'H' },
      { qubit: 1, slot: 1, type: 'CNOT' },
    ],
    targetProbabilities: {
      '00': 0.5,
      '01': 0,
      '10': 0,
      '11': 0.5,
    },
    hints: ['先对第一个量子比特应用H门', '然后用CNOT门将两个量子比特纠缠'],
    maxScore: 100,
  },
  {
    id: 'level-4',
    name: '挑战：相位翻转',
    difficulty: 'medium',
    description: '使用Z门实现相位翻转，在X基下测量观察干涉效应',
    qubits: 1,
    slots: 4,
    availableGates: ['H', 'X', 'Z'],
    targetGateSequence: [
      { qubit: 0, slot: 0, type: 'H' },
      { qubit: 0, slot: 1, type: 'Z' },
      { qubit: 0, slot: 2, type: 'H' },
    ],
    targetProbabilities: {
      '0': 0,
      '1': 1,
    },
    hints: ['H-Z-H序列相当于X门', '这是量子干涉的经典演示'],
    maxScore: 100,
  },
  {
    id: 'level-5',
    name: '专家：噪声抵消',
    difficulty: 'hard',
    description: '系统会自动添加比特翻转噪声，你需要添加X门来抵消它',
    qubits: 1,
    slots: 4,
    availableGates: ['H', 'X', 'Z'],
    requiredNoise: 'bit-flip',
    noiseOffsetGate: 'X',
    targetGateSequence: [
      { qubit: 0, slot: 0, type: 'H' },
      { qubit: 0, slot: 2, type: 'X' },
    ],
    targetProbabilities: {
      '0': 0.5,
      '1': 0.5,
    },
    hints: ['噪声会在slot 1位置自动添加', '在噪声之后添加X门可以抵消比特翻转'],
    maxScore: 100,
  },
];

export const getLevelById = (id: string): Level | undefined => {
  return levels.find((level) => level.id === id);
};

export const getLevelsByDifficulty = (difficulty: Level['difficulty']): Level[] => {
  return levels.filter((level) => level.difficulty === difficulty);
};

export const failOperationDemo = {
  gateOrderError: {
    description: '门顺序错误示例：在H门之后错误放置Z门（应放X门）',
    steps: [
      '打开关卡 level-4 (相位翻转)',
      '在q0的slot 0放置H门 ✓',
      '在q0的slot 1放置Z门 ✓',
      '在q0的slot 2放置Z门 ✗ (应放H门)',
      '提交后系统会检测到门顺序错误',
    ],
  },
  normalizationError: {
    description: '概率未归一示例：错误的电路配置导致概率溢出',
    steps: [
      '打开任意关卡',
      '错误地重复放置多个测量门',
      '或放置非幺正操作',
      '系统会检测到概率和不等于1',
    ],
  },
  noiseError: {
    description: '噪声未扣除示例：添加比特翻转噪声后未添加抵消门',
    steps: [
      '打开关卡 level-5 (噪声抵消)',
      '在q0的slot 0放置H门',
      '系统自动在slot 1添加比特翻转噪声',
      '不在slot 2添加X门进行抵消',
      '提交后系统会检测到噪声未扣除',
    ],
  },
};
