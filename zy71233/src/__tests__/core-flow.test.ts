import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeState,
  applyGate,
  simulateCircuit,
  calculateProbabilities,
  applyCNOT,
} from '@/utils/quantum/quantumEngine';
import {
  checkGateOrder,
  checkNormalization,
  checkNoiseCancellation,
  checkProbabilityMatch,
  validateCircuit,
} from '@/utils/validation/validator';
import { Circuit, GateType, NoiseType } from '@/types';
import { levels, getLevelById } from '@/data/levels';

describe('量子计算引擎 - 核心功能验证', () => {
  it('应该正确初始化量子态为 |0⟩', () => {
    const state = initializeState(1);
    expect(state[0].re).toBeCloseTo(1);
    expect(state[0].im).toBe(0);
    expect(state[1].re).toBe(0);
    expect(state[1].im).toBe(0);
  });

  it('应该正确初始化多量子比特态', () => {
    const state = initializeState(2);
    expect(state.length).toBe(4);
    expect(state[0].re).toBeCloseTo(1);
    for (let i = 1; i < 4; i++) {
      expect(state[i].re).toBe(0);
    }
  });

  it('H门应该创建叠加态', () => {
    let state = initializeState(1);
    state = applyGate(state, 'H', 0, 1);
    expect(state[0].re).toBeCloseTo(1 / Math.sqrt(2));
    expect(state[1].re).toBeCloseTo(1 / Math.sqrt(2));
  });

  it('X门应该翻转量子比特', () => {
    let state = initializeState(1);
    state = applyGate(state, 'X', 0, 1);
    expect(state[0].re).toBe(0);
    expect(state[1].re).toBeCloseTo(1);
  });

  it('应该正确计算概率分布', () => {
    let state = initializeState(1);
    state = applyGate(state, 'H', 0, 1);
    const probs = calculateProbabilities(state, 1, ['Z']);
    expect(probs['0']).toBeCloseTo(0.5);
    expect(probs['1']).toBeCloseTo(0.5);
  });

  it('应该正确模拟完整电路', () => {
    const result = simulateCircuit(
      1,
      [{ type: 'H', qubit: 0 }],
      [],
      ['Z']
    );
    expect(result.probabilities['0']).toBeCloseTo(0.5);
    expect(result.probabilities['1']).toBeCloseTo(0.5);
    expect(result.probabilitySum).toBeCloseTo(1);
  });

  it('Bell态电路应该产生正确的纠缠概率', () => {
    const result = simulateCircuit(
      2,
      [
        { type: 'H', qubit: 0 },
        { type: 'CNOT', qubit: 1, controlQubit: 0 },
      ],
      [],
      ['Z', 'Z']
    );
    expect(result.probabilities['00']).toBeCloseTo(0.5);
    expect(result.probabilities['01']).toBeCloseTo(0);
    expect(result.probabilities['10']).toBeCloseTo(0);
    expect(result.probabilities['11']).toBeCloseTo(0.5);
    expect(result.probabilitySum).toBeCloseTo(1);
  });

  it('CNOT缺少controlQubit时应该不产生纠缠（仅作为单量子门）', () => {
    const result = simulateCircuit(
      2,
      [
        { type: 'H', qubit: 0 },
        { type: 'CNOT', qubit: 1 },
      ],
      [],
      ['Z', 'Z']
    );
    expect(result.probabilities['00']).toBeCloseTo(0.5);
    expect(result.probabilities['10']).toBeCloseTo(0.5);
    expect(result.probabilities['11']).toBeCloseTo(0);
    expect(result.probabilitySum).toBeCloseTo(1);
  });

  it('applyCNOT应该直接产生纠缠', () => {
    let state = initializeState(2);
    state = applyGate(state, 'H', 0, 2);
    state = applyCNOT(state, 0, 1, 2);
    const probs = calculateProbabilities(state, 2, ['Z', 'Z']);
    expect(probs['00']).toBeCloseTo(0.5);
    expect(probs['11']).toBeCloseTo(0.5);
  });
});

describe('错误检测系统 - 核心验证', () => {
  it('应该检测缺失的量子门', () => {
    const targetSequence = [
      { qubit: 0, slot: 0, type: 'H' as GateType },
    ];
    const errors = checkGateOrder([], targetSequence);
    expect(errors.length).toBe(1);
    expect(errors[0].type).toBe('missing_gate');
    expect(errors[0].penalty).toBe(15);
  });

  it('应该检测错误的门类型', () => {
    const targetSequence = [
      { qubit: 0, slot: 0, type: 'H' as GateType },
    ];
    const gates = [
      { id: '1', type: 'X' as GateType, position: { qubit: 0, slot: 0 } },
    ];
    const errors = checkGateOrder(gates, targetSequence);
    expect(errors.length).toBe(1);
    expect(errors[0].type).toBe('wrong_order');
    expect(errors[0].expected).toBe('H');
    expect(errors[0].actual).toBe('X');
  });

  it('应该检测多余的量子门', () => {
    const targetSequence = [
      { qubit: 0, slot: 0, type: 'H' as GateType },
    ];
    const gates = [
      { id: '1', type: 'H' as GateType, position: { qubit: 0, slot: 0 } },
      { id: '2', type: 'X' as GateType, position: { qubit: 0, slot: 1 } },
    ];
    const errors = checkGateOrder(gates, targetSequence);
    expect(errors.length).toBe(1);
    expect(errors[0].type).toBe('extra_gate');
  });

  it('应该通过正确的门序列', () => {
    const targetSequence = [
      { qubit: 0, slot: 0, type: 'H' as GateType },
    ];
    const gates = [
      { id: '1', type: 'H' as GateType, position: { qubit: 0, slot: 0 } },
    ];
    const errors = checkGateOrder(gates, targetSequence);
    expect(errors.length).toBe(0);
  });

  it('应该检测概率未归一', () => {
    const error = checkNormalization(1.5);
    expect(error).not.toBeNull();
    expect(error?.penalty).toBe(20);
    expect(Math.abs(error?.actualSum - 1.5)).toBeLessThan(0.001);
  });

  it('应该通过已归一的概率', () => {
    const error = checkNormalization(1.0);
    expect(error).toBeNull();
  });

  it('应该通过接近1的概率（在容差范围内）', () => {
    const error = checkNormalization(0.9999);
    expect(error).toBeNull();
  });

  it('应该检测未抵消的噪声', () => {
    const circuit: Circuit = {
      id: 'test',
      qubits: 1,
      slots: 3,
      gates: [],
      noiseCards: [
        { id: 'n1', type: 'bit-flip' as NoiseType, position: { qubit: 0, slot: 1 }, probability: 0.3 },
      ],
      measurementBasis: ['Z'],
    };
    const error = checkNoiseCancellation(circuit, 'bit-flip', 'X');
    expect(error).not.toBeNull();
    expect(error?.type).toBe('no_cancellation');
    expect(error?.penalty).toBe(25);
  });

  it('应该检测位置错误的抵消门', () => {
    const circuit: Circuit = {
      id: 'test',
      qubits: 1,
      slots: 3,
      gates: [
        { id: 'g1', type: 'X' as GateType, position: { qubit: 0, slot: 0 } },
      ],
      noiseCards: [
        { id: 'n1', type: 'bit-flip' as NoiseType, position: { qubit: 0, slot: 1 }, probability: 0.3 },
      ],
      measurementBasis: ['Z'],
    };
    const error = checkNoiseCancellation(circuit, 'bit-flip', 'X');
    expect(error).not.toBeNull();
    expect(error?.type).toBe('wrong_cancellation');
  });

  it('应该通过正确的噪声抵消', () => {
    const circuit: Circuit = {
      id: 'test',
      qubits: 1,
      slots: 3,
      gates: [
        { id: 'g1', type: 'X' as GateType, position: { qubit: 0, slot: 2 } },
      ],
      noiseCards: [
        { id: 'n1', type: 'bit-flip' as NoiseType, position: { qubit: 0, slot: 1 }, probability: 0.3 },
      ],
      measurementBasis: ['Z'],
    };
    const error = checkNoiseCancellation(circuit, 'bit-flip', 'X');
    expect(error).toBeNull();
  });

  it('应该检测概率不匹配', () => {
    const actual = { '00': 0.6, '01': 0.2, '10': 0.1, '11': 0.1 };
    const target = { '00': 0.5, '01': 0.0, '10': 0.0, '11': 0.5 };
    const error = checkProbabilityMatch(actual, target);
    expect(error).not.toBeNull();
    expect(error?.mismatches.length).toBeGreaterThanOrEqual(3);
    expect(error?.penalty).toBe(error?.mismatches.length * 10);
  });

  it('应该通过匹配的概率（在容差范围内）', () => {
    const actual = { '00': 0.51, '01': 0.01, '10': 0.01, '11': 0.47 };
    const target = { '00': 0.5, '01': 0.0, '10': 0.0, '11': 0.5 };
    const error = checkProbabilityMatch(actual, target);
    expect(error).toBeNull();
  });

  it('完全相同的概率应该通过', () => {
    const actual = { '00': 0.5, '11': 0.5 };
    const target = { '00': 0.5, '11': 0.5 };
    const error = checkProbabilityMatch(actual, target);
    expect(error).toBeNull();
  });
});

describe('完整验证流程 - 端到端测试', () => {
  it('应该验证正确的Bell态电路', () => {
    const level = getLevelById('demo-correct');
    expect(level).toBeDefined();

    const circuit: Circuit = {
      id: 'test-bell',
      qubits: 2,
      slots: 4,
      gates: [
        { id: 'g1', type: 'H' as GateType, position: { qubit: 0, slot: 0 } },
        { id: 'g2', type: 'CNOT' as GateType, position: { qubit: 1, slot: 1 }, controlQubit: 0 },
      ],
      noiseCards: [],
      measurementBasis: ['Z', 'Z'],
    };

    const result = validateCircuit(circuit, level!);
    expect(result.gateOrderErrors.length).toBe(0);
    expect(result.normalizationError).toBeNull();
    expect(result.noiseError).toBeNull();
    expect(result.probabilityMismatchError).toBeNull();
    expect(result.isValid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(level!.maxScore - 10);
    expect(['S', 'A']).toContain(result.grade);
  });

  it('CNOT缺少controlQubit应该导致验证失败', () => {
    const level = getLevelById('demo-correct');
    expect(level).toBeDefined();

    const circuit: Circuit = {
      id: 'test-bell-no-control',
      qubits: 2,
      slots: 4,
      gates: [
        { id: 'g1', type: 'H' as GateType, position: { qubit: 0, slot: 0 } },
        { id: 'g2', type: 'CNOT' as GateType, position: { qubit: 1, slot: 1 } },
      ],
      noiseCards: [],
      measurementBasis: ['Z', 'Z'],
    };

    const result = validateCircuit(circuit, level!);
    expect(result.gateOrderErrors.length).toBe(0);
    expect(result.probabilityMismatchError).not.toBeNull();
    expect(result.isValid).toBe(false);
  });

  it('应该检测门顺序错误的电路', () => {
    const level = getLevelById('demo-correct');
    expect(level).toBeDefined();

    const circuit: Circuit = {
      id: 'test-wrong',
      qubits: 2,
      slots: 4,
      gates: [
        { id: 'g1', type: 'X' as GateType, position: { qubit: 0, slot: 0 } },
        { id: 'g2', type: 'H' as GateType, position: { qubit: 1, slot: 1 } },
      ],
      noiseCards: [],
      measurementBasis: ['Z', 'Z'],
    };

    const result = validateCircuit(circuit, level!);
    expect(result.isValid).toBe(false);
    expect(result.gateOrderErrors.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(level!.maxScore);
  });

  it('应该给错误电路正确的评分等级', () => {
    const level = getLevelById('demo-wrong');
    expect(level).toBeDefined();

    const circuit: Circuit = {
      id: 'test-fail',
      qubits: 2,
      slots: 5,
      gates: [],
      noiseCards: [
        { id: 'n1', type: 'bit-flip' as NoiseType, position: { qubit: 0, slot: 1 }, probability: 0.3 },
      ],
      measurementBasis: ['Z', 'Z'],
    };

    const result = validateCircuit(circuit, level!);
    expect(result.grade).toBe('F');
    expect(result.score).toBeLessThan(level!.maxScore * 0.4);
  });

  it('所有关卡都应该有正确的配置', () => {
    levels.forEach((level) => {
      expect(level.id).toBeDefined();
      expect(level.name).toBeDefined();
      expect(level.qubits).toBeGreaterThan(0);
      expect(level.slots).toBeGreaterThan(0);
      expect(level.availableGates.length).toBeGreaterThan(0);
      expect(Object.keys(level.targetProbabilities).length).toBe(2 ** level.qubits);
    });
  });
});

describe('拖拽系统 - 组件结构验证', () => {
  it('DraggableGate 应该正确导出并接受必要的props', () => {
    const fs = require('fs');
    const content = fs.readFileSync(
      '/Users/lzy/pro/solo/workspaces/zy71233/src/components/gates/QuantumGate.tsx',
      'utf-8'
    );
    expect(content).toContain('export const DraggableGate');
  });

  it('DroppableSlot 应该正确导出并接受必要的props', () => {
    const fs = require('fs');
    const content = fs.readFileSync(
      '/Users/lzy/pro/solo/workspaces/zy71233/src/components/gates/QuantumGate.tsx',
      'utf-8'
    );
    expect(content).toContain('export const DroppableSlot');
  });

  it('DraggableGate 应该使用 useDraggable hook', () => {
    const fs = require('fs');
    const content = fs.readFileSync(
      '/Users/lzy/pro/solo/workspaces/zy71233/src/components/gates/QuantumGate.tsx',
      'utf-8'
    );
    expect(content).toContain('useDraggable');
    expect(content).toContain('DraggableGate');
  });

  it('DroppableSlot 应该使用 useDroppable hook', () => {
    const fs = require('fs');
    const content = fs.readFileSync(
      '/Users/lzy/pro/solo/workspaces/zy71233/src/components/gates/QuantumGate.tsx',
      'utf-8'
    );
    expect(content).toContain('useDroppable');
    expect(content).toContain('DroppableSlot');
  });

  it('GateLibrary 应该使用 DraggableGate 组件', () => {
    const fs = require('fs');
    const content = fs.readFileSync(
      '/Users/lzy/pro/solo/workspaces/zy71233/src/components/circuit/CircuitEditor.tsx',
      'utf-8'
    );
    expect(content).toContain('DraggableGate');
  });

  it('CircuitEditor 应该使用 DroppableSlot 组件', () => {
    const fs = require('fs');
    const content = fs.readFileSync(
      '/Users/lzy/pro/solo/workspaces/zy71233/src/components/circuit/CircuitEditor.tsx',
      'utf-8'
    );
    expect(content).toContain('DroppableSlot');
  });

  it('Game 页面应该包裹 DndContext', () => {
    const fs = require('fs');
    const content = fs.readFileSync(
      '/Users/lzy/pro/solo/workspaces/zy71233/src/pages/Game.tsx',
      'utf-8'
    );
    expect(content).toContain('DndContext');
    expect(content).toContain('handleDragStart');
    expect(content).toContain('handleDragEnd');
    expect(content).toContain('DragOverlay');
  });

  it('拖拽数据流应该正确传递 gateType', () => {
    const fs = require('fs');
    const gameContent = fs.readFileSync(
      '/Users/lzy/pro/solo/workspaces/zy71233/src/pages/Game.tsx',
      'utf-8'
    );
    expect(gameContent).toContain('active.data.current?.gateType');
    expect(gameContent).toContain('overId.startsWith(\'slot-\')');
  });
});

describe('状态管理 - 核心操作验证', () => {
  let useGameStore: any;

  beforeEach(async () => {
    const module = await import('@/store/gameStore');
    useGameStore = module.useGameStore;
    useGameStore.setState({
      currentLevel: null,
      currentCircuit: null,
      currentSession: null,
      validationResult: null,
      completedLevels: [],
      sessions: [],
    });
  });

  it('应该正确设置当前关卡', () => {
    const { setCurrentLevel } = useGameStore.getState();

    setCurrentLevel('level-1');
    const state = useGameStore.getState();

    expect(state.currentLevel).not.toBeNull();
    expect(state.currentLevel?.id).toBe('level-1');
    expect(state.currentCircuit).not.toBeNull();
    expect(state.currentCircuit?.qubits).toBe(1);
  });

  it('应该正确添加量子门到电路', () => {
    const { setCurrentLevel, addGate } = useGameStore.getState();

    setCurrentLevel('level-1');
    addGate({
      id: 'test-gate',
      type: 'H',
      position: { qubit: 0, slot: 0 },
    });

    const state = useGameStore.getState();
    expect(state.currentCircuit?.gates.length).toBe(1);
    expect(state.currentCircuit?.gates[0].type).toBe('H');
  });

  it('应该正确记录操作日志', () => {
    const { setCurrentLevel, addGate } = useGameStore.getState();

    setCurrentLevel('level-1');
    const initialOpCount = useGameStore.getState().currentSession?.operations.length || 0;

    addGate({
      id: 'test-gate',
      type: 'H',
      position: { qubit: 0, slot: 0 },
    });

    const state = useGameStore.getState();
    expect(state.currentSession?.operations.length).toBe(initialOpCount + 1);
    expect(state.currentSession?.operations[initialOpCount].type).toBe('add_gate');
  });

  it('应该正确提交并生成验证结果', () => {
    const { setCurrentLevel, addGate, submitAnswer } = useGameStore.getState();

    setCurrentLevel('demo-correct');
    addGate({
      id: 'g1',
      type: 'H',
      position: { qubit: 0, slot: 0 },
    });
    addGate({
      id: 'g2',
      type: 'CNOT',
      position: { qubit: 0, slot: 1 },
    });

    submitAnswer();

    const state = useGameStore.getState();
    expect(state.validationResult).not.toBeNull();
    expect(state.currentSession?.validationResult).not.toBeNull();
    expect(state.currentSession?.endTime).not.toBeUndefined();
  });

  it('应该正确导出实验报告', () => {
    const { setCurrentLevel, addGate, submitAnswer, exportReport } = useGameStore.getState();

    setCurrentLevel('demo-correct');
    addGate({
      id: 'g1',
      type: 'H',
      position: { qubit: 0, slot: 0 },
    });
    addGate({
      id: 'g2',
      type: 'CNOT',
      position: { qubit: 0, slot: 1 },
    });
    submitAnswer();

    const report = exportReport();
    expect(report).not.toBe('');

    const parsedReport = JSON.parse(report);
    expect(parsedReport.sessionId).toBeDefined();
    expect(parsedReport.levelId).toBe('demo-correct');
    expect(parsedReport.circuit).toBeDefined();
    expect(parsedReport.operations).toBeDefined();
    expect(parsedReport.validationResult).toBeDefined();
  });
});
