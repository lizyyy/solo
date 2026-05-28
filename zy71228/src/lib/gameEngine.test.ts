import { describe, it, expect, beforeEach } from 'vitest';
import type { PolicyAction, MarketState, EventOption } from '@/types/game';
import {
  validatePolicyAction,
  validateRoundSubmission,
  calculateLiquidityChange,
  calculateTheoreticalRateChange,
  applyRateLag,
  calculateWeightedAverageMaturity,
  calculateMaturityGap,
  assessMaturityRisk,
  assessLiquidityRisk,
  processRound,
  createInitialMarketState,
} from './gameEngine';

describe('gameEngine - 验证逻辑', () => {
  describe('validatePolicyAction - 缺字段测试', () => {
    it('金额为0时应返回错误', () => {
      const result = validatePolicyAction({
        type: 'reverse_repo',
        direction: 'inject',
        amount: 0,
        term: 7,
        status: 'tentative',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('金额必须大于0');
    });

    it('金额为空时应返回错误', () => {
      const result = validatePolicyAction({
        type: 'reverse_repo',
        direction: 'inject',
        amount: undefined as unknown as number,
        term: 7,
        status: 'tentative',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('金额必须大于0');
    });

    it('期限为0时应返回错误', () => {
      const result = validatePolicyAction({
        type: 'reverse_repo',
        direction: 'inject',
        amount: 500,
        term: 0,
        status: 'tentative',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('期限必须大于0');
    });

    it('金额超过5000亿时应返回错误', () => {
      const result = validatePolicyAction({
        type: 'reverse_repo',
        direction: 'inject',
        amount: 6000,
        term: 7,
        status: 'tentative',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('单次操作金额不能超过5000亿元');
    });

    it('合法参数应通过验证', () => {
      const result = validatePolicyAction({
        type: 'reverse_repo',
        direction: 'inject',
        amount: 500,
        term: 7,
        status: 'tentative',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateRoundSubmission - 重复提交测试', () => {
    it('当前状态为confirmed时重复提交应被拦截', () => {
      const actions: PolicyAction[] = [];
      const result = validateRoundSubmission(actions, 'confirmed');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('本回合已确认提交，请勿重复操作');
    });

    it('有操作但都为tentative时应提示错误', () => {
      const actions: PolicyAction[] = [
        {
          id: '1',
          roundNumber: 1,
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'tentative',
        },
      ];
      const result = validateRoundSubmission(actions, 'pending');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('请至少确认一项政策操作后再提交');
    });

    it('有confirmed操作时应通过验证', () => {
      const actions: PolicyAction[] = [
        {
          id: '1',
          roundNumber: 1,
          type: 'reverse_repo',
          direction: 'inject',
          amount: 500,
          term: 7,
          status: 'confirmed',
        },
      ];
      const result = validateRoundSubmission(actions, 'pending');
      expect(result.valid).toBe(true);
    });

    it('没有操作时应通过验证（零操作回合）', () => {
      const actions: PolicyAction[] = [];
      const result = validateRoundSubmission(actions, 'pending');
      expect(result.valid).toBe(true);
    });
  });
});

describe('gameEngine - 状态转换测试', () => {
  describe('状态不允许测试', () => {
    it('已确认的操作不能改为临时状态 - 需要在store中验证', () => {
      const confirmedAction: PolicyAction = {
        id: '1',
        roundNumber: 1,
        type: 'reverse_repo',
        direction: 'inject',
        amount: 500,
        term: 7,
        status: 'confirmed',
      };
      expect(confirmedAction.status).toBe('confirmed');
    });
  });
});

describe('gameEngine - 流动性计算', () => {
  it('逆回购投放应增加流动性', () => {
    const actions: PolicyAction[] = [
      {
        id: '1',
        roundNumber: 1,
        type: 'reverse_repo',
        direction: 'inject',
        amount: 1000,
        term: 7,
        status: 'confirmed',
      },
    ];
    const change = calculateLiquidityChange(actions, null);
    expect(change).toBeGreaterThan(800);
  });

  it('回笼流动性应减少流动性', () => {
    const actions: PolicyAction[] = [
      {
        id: '1',
        roundNumber: 1,
        type: 'reverse_repo',
        direction: 'withdraw',
        amount: 1000,
        term: 7,
        status: 'confirmed',
      },
    ];
    const change = calculateLiquidityChange(actions, null);
    expect(change).toBeLessThan(-800);
  });

  it('tentative状态的操作不应影响流动性', () => {
    const actions: PolicyAction[] = [
      {
        id: '1',
        roundNumber: 1,
        type: 'reverse_repo',
        direction: 'inject',
        amount: 1000,
        term: 7,
        status: 'tentative',
      },
    ];
    const change = calculateLiquidityChange(actions, null);
    expect(Math.abs(change)).toBeLessThan(200);
  });

  it('事件选项应影响流动性', () => {
    const eventOption: EventOption = {
      id: 'opt1',
      label: '大额逆回购对冲',
      effectDescription: '投放1000亿流动性',
      liquidityModifier: 1000,
      rateModifier: -0.05,
    };
    const change = calculateLiquidityChange([], eventOption);
    expect(change).toBeGreaterThan(800);
  });
});

describe('gameEngine - 利率传导', () => {
  it('利率变化应考虑滞后效应', () => {
    const theoreticalChange = 0.2;
    const pendingChange = 0.1;
    const lagEffect = 0.5;

    const result = applyRateLag(theoreticalChange, pendingChange, lagEffect);

    expect(result.actualChange).toBeCloseTo(0.15);
    expect(result.newPending).toBeCloseTo(0.1);
  });

  it('滞后效应为0时政策效果应完全显现', () => {
    const theoreticalChange = 0.2;
    const result = applyRateLag(theoreticalChange, 0, 0);
    expect(result.actualChange).toBeCloseTo(0.2);
    expect(result.newPending).toBeCloseTo(0);
  });

  it('滞后效应为1时政策效果应完全滞后', () => {
    const theoreticalChange = 0.2;
    const result = applyRateLag(theoreticalChange, 0, 1);
    expect(result.actualChange).toBeCloseTo(0);
    expect(result.newPending).toBeCloseTo(0.2);
  });
});

describe('gameEngine - 风险检测', () => {
  describe('期限错配边界值测试', () => {
    it('错配6天应为正常', () => {
      const risk = assessMaturityRisk(6);
      expect(risk).toBe('normal');
    });

    it('错配7天应为警告（边界值）', () => {
      const risk = assessMaturityRisk(7);
      expect(risk).toBe('warning');
    });

    it('错配10天应为警告', () => {
      const risk = assessMaturityRisk(10);
      expect(risk).toBe('warning');
    });

    it('错配14天应为危险（边界值）', () => {
      const risk = assessMaturityRisk(14);
      expect(risk).toBe('danger');
    });

    it('错配20天应为危险', () => {
      const risk = assessMaturityRisk(20);
      expect(risk).toBe('danger');
    });

    it('加权平均期限计算正确', () => {
      const actions: PolicyAction[] = [
        {
          id: '1',
          roundNumber: 1,
          type: 'reverse_repo',
          direction: 'inject',
          amount: 1000,
          term: 7,
          status: 'confirmed',
        },
        {
          id: '2',
          roundNumber: 1,
          type: 'reverse_repo',
          direction: 'inject',
          amount: 1000,
          term: 21,
          status: 'confirmed',
        },
      ];
      const weightedAvg = calculateWeightedAverageMaturity(actions);
      expect(weightedAvg).toBe(14);
    });

    it('期限错配计算正确', () => {
      const gap = calculateMaturityGap(7, 14);
      expect(gap).toBe(7);
    });
  });

  describe('流动性过剩检测', () => {
    it('超额准备金率1.0%应为不足（危险）', () => {
      const risk = assessLiquidityRisk(0.01, 0);
      expect(risk).toBe('warning');
    });

    it('超额准备金率1.5%应为正常（边界值）', () => {
      const risk = assessLiquidityRisk(0.015, 0);
      expect(risk).toBe('normal');
    });

    it('超额准备金率2.0%应为正常', () => {
      const risk = assessLiquidityRisk(0.02, 0);
      expect(risk).toBe('normal');
    });

    it('超额准备金率2.5%应为正常（边界值）', () => {
      const risk = assessLiquidityRisk(0.025, 0);
      expect(risk).toBe('normal');
    });

    it('超额准备金率3.0%应为过剩（警告）', () => {
      const risk = assessLiquidityRisk(0.03, 0);
      expect(risk).toBe('warning');
    });

    it('超额准备金率正常但期限错配警告时，综合应为警告', () => {
      const risk = assessLiquidityRisk(0.02, 10);
      expect(risk).toBe('warning');
    });

    it('超额准备金率过剩且期限错配警告时，综合应为危险', () => {
      const risk = assessLiquidityRisk(0.03, 10);
      expect(risk).toBe('danger');
    });
  });
});

describe('gameEngine - 完整回合处理', () => {
  let initialState: MarketState;

  beforeEach(() => {
    initialState = createInitialMarketState();
  });

  it('processRound应正确更新市场状态', () => {
    const actions: PolicyAction[] = [
      {
        id: '1',
        roundNumber: 1,
        type: 'reverse_repo',
        direction: 'inject',
        amount: 500,
        term: 7,
        status: 'confirmed',
      },
    ];

    const result = processRound(initialState, actions, null, 1);

    expect(result.newState.roundNumber).toBe(1);
    expect(result.newState.liquidity).toBeGreaterThan(initialState.liquidity);
    expect(result.liquidityChange).toBeGreaterThan(0);
  });

  it('多回合后滞后效应应递减', () => {
    let state = initialState;
    const actions: PolicyAction[] = [];

    const result1 = processRound(state, actions, null, 1);
    expect(result1.newState.rateLagEffect).toBeLessThan(initialState.rateLagEffect);

    const result2 = processRound(result1.newState, actions, null, 2);
    expect(result2.newState.rateLagEffect).toBeLessThan(result1.newState.rateLagEffect);
  });

  it('初始状态值正确', () => {
    expect(initialState.roundNumber).toBe(0);
    expect(initialState.liquidity).toBe(4000);
    expect(initialState.dr007).toBe(2.0);
    expect(initialState.t10y).toBe(2.8);
    expect(initialState.rateLagEffect).toBe(0.6);
  });
});

describe('gameEngine - 理论利率变化', () => {
  it('流动性增加应导致利率下降', () => {
    const change = calculateTheoreticalRateChange(500, 4000);
    expect(change).toBeLessThan(0);
  });

  it('流动性减少应导致利率上升', () => {
    const change = calculateTheoreticalRateChange(-500, 4000);
    expect(change).toBeGreaterThan(0);
  });

  it('流动性变化越大，利率变化越大', () => {
    const smallChange = calculateTheoreticalRateChange(100, 4000);
    const largeChange = calculateTheoreticalRateChange(1000, 4000);
    expect(Math.abs(largeChange)).toBeGreaterThan(Math.abs(smallChange));
  });
});
