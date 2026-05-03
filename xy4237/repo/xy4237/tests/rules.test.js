const RuleEngine = require('../src/rules');

describe('RuleEngine', () => {
  let rules;

  beforeEach(() => {
    rules = new RuleEngine();
  });

  describe('ruleMissingResponsible', () => {
    it('应报告危险道具缺少负责人的问题', () => {
      const tasks = [
        { id: '1', name: '危险道具', isDangerous: true, responsible: null },
        { id: '2', name: '普通道具', isDangerous: false, responsible: '张三' }
      ];

      const result = rules.ruleMissingResponsible(tasks, {}, {});

      expect(result.issues.length).toBe(1);
      expect(result.issues[0].message).toContain('缺少负责人');
    });

    it('应报告普通任务缺少负责人的警告', () => {
      const tasks = [
        { id: '1', name: '普通道具', isDangerous: false, responsible: null, type: 'prop' },
        { id: '2', name: '有负责人', isDangerous: false, responsible: '张三', type: 'prop' }
      ];

      const result = rules.ruleMissingResponsible(tasks, {}, {});

      expect(result.warnings.length).toBe(1);
    });

    it('不应报告灯光任务缺少负责人', () => {
      const tasks = [
        { id: '1', name: '灯光Cue', type: 'lighting', responsible: null, isDangerous: false }
      ];

      const result = rules.ruleMissingResponsible(tasks, {}, {});

      expect(result.issues.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });
  });

  describe('ruleDangerousItemUnconfirmed', () => {
    it('应报告未确认的危险道具', () => {
      const tasks = [
        { id: '1', name: '危险道具', isDangerous: true, confirmed: false },
        { id: '2', name: '已确认', isDangerous: true, confirmed: true }
      ];

      const result = rules.ruleDangerousItemUnconfirmed(tasks, {}, {});

      expect(result.issues.length).toBe(1);
      expect(result.issues[0].message).toContain('未经确认');
    });

    it('当选项关闭时不应报告', () => {
      const disabledRules = new RuleEngine({ dangerousItemsRequireConfirmation: false });
      
      const tasks = [
        { id: '1', name: '危险道具', isDangerous: true, confirmed: false }
      ];

      const result = disabledRules.ruleDangerousItemUnconfirmed(tasks, {}, {});

      expect(result.issues.length).toBe(0);
    });
  });

  describe('ruleSceneChangeTimeExceeded', () => {
    it('应报告超过时间阈值的任务', () => {
      const byScene = {
        '第一幕': [
          { id: '1', type: 'prop', name: '超时道具', time: 200, scene: '第一幕' }
        ]
      };

      const result = rules.ruleSceneChangeTimeExceeded([], {}, byScene);

      expect(result.issues.length).toBe(1);
      expect(result.issues[0].message).toContain('超过阈值');
    });

    it('应报告接近时间阈值的警告', () => {
      const byScene = {
        '第一幕': [
          { id: '1', type: 'prop', name: '接近阈值', time: 100, scene: '第一幕' }
        ]
      };

      const result = rules.ruleSceneChangeTimeExceeded([], {}, byScene);

      expect(result.warnings.length).toBe(1);
    });
  });

  describe('ruleDuplicateCues', () => {
    it('应报告同一场景的重复Cue', () => {
      const byScene = {
        '第一幕': [
          { id: '1', name: '道具1', type: 'prop', cue: 'Cue01', scene: '第一幕' },
          { id: '2', name: '道具2', type: 'prop', cue: 'Cue01', scene: '第一幕' }
        ]
      };

      const result = rules.ruleDuplicateCues([], {}, byScene);

      expect(result.issues.length).toBe(1);
      expect(result.issues[0].message).toContain('重复');
    });

    it('应报告灯光Cue编号缺口', () => {
      const tasks = [
        { id: '1', type: 'lighting', cue: '1', scene: '第一幕' },
        { id: '2', type: 'lighting', cue: '3', scene: '第一幕' }
      ];

      const result = rules.ruleDuplicateCues(tasks, {}, {});

      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].message).toContain('缺口');
    });
  });

  describe('ruleActorConflict', () => {
    it('应报告同一演员在同一时间点的冲突任务', () => {
      const tasks = [
        { id: '1', type: 'actor', name: '哈姆雷特', scene: '第一幕', cue: 'Cue01', action: '上场' },
        { id: '2', type: 'actor', name: '哈姆雷特', scene: '第一幕', cue: 'Cue01', action: '下场' }
      ];

      const result = rules.ruleActorConflict(tasks, {}, {});

      expect(result.issues.length).toBe(1);
      expect(result.issues[0].message).toContain('冲突');
    });

    it('不应报告不同时间点的任务', () => {
      const tasks = [
        { id: '1', type: 'actor', name: '哈姆雷特', scene: '第一幕', cue: 'Cue01', action: '上场' },
        { id: '2', type: 'actor', name: '哈姆雷特', scene: '第一幕', cue: 'Cue02', action: '下场' }
      ];

      const result = rules.ruleActorConflict(tasks, {}, {});

      expect(result.issues.length).toBe(0);
    });
  });

  describe('ruleTimeGap', () => {
    it('应报告同一时间点过多任务的警告', () => {
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        scene: '第一幕',
        time: 0,
        name: `任务${i}`
      }));

      const result = rules.ruleTimeGap(tasks, {}, {});

      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].message).toContain('拥堵');
    });
  });

  describe('addRule', () => {
    it('应允许添加自定义规则', () => {
      const customRule = jest.fn(() => ({
        issues: [{ message: '自定义规则问题' }],
        warnings: []
      }));

      rules.addRule(customRule);

      expect(rules.rules).toContain(customRule);
    });
  });

  describe('configure', () => {
    it('应允许配置规则选项', () => {
      rules.configure({
        maxSceneChangeTime: 60,
        checkResponsible: false
      });

      expect(rules.options.maxSceneChangeTime).toBe(60);
      expect(rules.options.checkResponsible).toBe(false);
    });
  });

  describe('checkAll', () => {
    it('应执行所有规则并汇总结果', async () => {
      const tasks = [
        { id: '1', name: '危险道具', isDangerous: true, responsible: null, confirmed: false, type: 'prop' }
      ];

      const result = await rules.checkAll(tasks, {});

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.stats.issuesFound).toBeGreaterThan(0);
    });
  });
});
