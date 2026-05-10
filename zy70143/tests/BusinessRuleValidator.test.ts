import { BusinessRuleValidator } from '../src/services/BusinessRuleValidator';
import { VulnerabilityStatus, Severity, RiskLevel } from '../src/types';

describe('BusinessRuleValidator', () => {
  describe('validateAssignment', () => {
    it('应该允许给 NEW 状态的漏洞分配负责人', () => {
      const result = BusinessRuleValidator.validateAssignment(
        VulnerabilityStatus.NEW,
        null,
        'user-123',
        false
      );
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('应该阻止分配空的负责人ID', () => {
      const result = BusinessRuleValidator.validateAssignment(
        VulnerabilityStatus.NEW,
        null,
        '',
        false
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('负责人ID不能为空');
    });

    it('应该阻止重复分配同一负责人', () => {
      const result = BusinessRuleValidator.validateAssignment(
        VulnerabilityStatus.ASSIGNED,
        'user-123',
        'user-123',
        false
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('漏洞已经分配给该负责人，重复操作无意义');
    });

    it('应该在人工覆盖时允许重复分配', () => {
      const result = BusinessRuleValidator.validateAssignment(
        VulnerabilityStatus.ASSIGNED,
        'user-123',
        'user-123',
        true
      );
      expect(result.valid).toBe(true);
    });

    it('应该阻止分配已关闭的漏洞', () => {
      const result = BusinessRuleValidator.validateAssignment(
        VulnerabilityStatus.CLOSED,
        null,
        'user-123',
        false
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('已关闭的漏洞不能分配负责人');
    });

    it('应该在重新分配时发出警告', () => {
      const result = BusinessRuleValidator.validateAssignment(
        VulnerabilityStatus.ASSIGNED,
        'user-old',
        'user-new',
        false
      );
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('该漏洞已有其他负责人，重新分配需要确认');
    });
  });

  describe('validateStatusTransition', () => {
    it('应该允许正常的状态转换 NEW -> ASSIGNED', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.NEW,
        VulnerabilityStatus.ASSIGNED,
        'user-123',
        false,
        false
      );
      expect(result.valid).toBe(true);
    });

    it('应该允许正常的状态转换 ASSIGNED -> IN_PROGRESS', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.ASSIGNED,
        VulnerabilityStatus.IN_PROGRESS,
        'user-123',
        false,
        false
      );
      expect(result.valid).toBe(true);
    });

    it('应该允许正常的状态转换 IN_PROGRESS -> FIXED', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.IN_PROGRESS,
        VulnerabilityStatus.FIXED,
        'user-123',
        false,
        false
      );
      expect(result.valid).toBe(true);
    });

    it('应该允许正常的状态转换 FIXED -> DEPLOYED', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.FIXED,
        VulnerabilityStatus.DEPLOYED,
        'user-123',
        false,
        false
      );
      expect(result.valid).toBe(true);
    });

    it('应该允许正常的状态转换 DEPLOYED -> CLOSED', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.DEPLOYED,
        VulnerabilityStatus.CLOSED,
        'user-123',
        false,
        false
      );
      expect(result.valid).toBe(true);
    });

    it('应该阻止非法状态转换 NEW -> FIXED', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.NEW,
        VulnerabilityStatus.FIXED,
        'user-123',
        false,
        false
      );
      expect(result.valid).toBe(false);
      expect(result.requiresManualOverride).toBe(true);
    });

    it('应该阻止非法状态转换 CLOSED -> ASSIGNED', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.CLOSED,
        VulnerabilityStatus.ASSIGNED,
        'user-123',
        false,
        false
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('已关闭的漏洞状态不能修改');
    });

    it('应该在人工覆盖时允许非法状态转换', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.NEW,
        VulnerabilityStatus.FIXED,
        'user-123',
        false,
        true
      );
      expect(result.valid).toBe(true);
    });

    it('应该阻止没有负责人的状态转换', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.ASSIGNED,
        VulnerabilityStatus.IN_PROGRESS,
        null,
        false,
        false
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('漏洞尚未分配负责人，不能进入非待分配状态');
    });

    it('同一状态转换应该返回警告但有效', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.ASSIGNED,
        VulnerabilityStatus.ASSIGNED,
        'user-123',
        false,
        false
      );
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('状态未发生变化');
    });

    it('之前被人工修正过的状态转换应该发出警告', () => {
      const result = BusinessRuleValidator.validateStatusTransition(
        VulnerabilityStatus.IN_PROGRESS,
        VulnerabilityStatus.FIXED,
        'user-123',
        true,
        false
      );
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('该漏洞状态曾被人工修正，此次修改建议添加备注说明');
    });
  });

  describe('validateDelayRequest', () => {
    it('应该允许有效的延期申请', () => {
      const today = new Date();
      const originalDueDate = new Date(today);
      originalDueDate.setDate(originalDueDate.getDate() + 14);
      const newDueDate = new Date(today);
      newDueDate.setDate(newDueDate.getDate() + 20);

      const result = BusinessRuleValidator.validateDelayRequest(
        VulnerabilityStatus.IN_PROGRESS,
        0,
        Severity.HIGH,
        originalDueDate,
        newDueDate,
        '需要协调多个团队进行测试，预计需要额外的时间来确保质量',
        '期间将使用临时防护措施和监控机制来减少风险暴露',
        false
      );
      expect(result.valid).toBe(true);
    });

    it('应该阻止延期理由太短', () => {
      const today = new Date();
      const originalDueDate = new Date(today);
      originalDueDate.setDate(originalDueDate.getDate() + 14);
      const newDueDate = new Date(today);
      newDueDate.setDate(newDueDate.getDate() + 30);

      const result = BusinessRuleValidator.validateDelayRequest(
        VulnerabilityStatus.IN_PROGRESS,
        0,
        Severity.HIGH,
        originalDueDate,
        newDueDate,
        '太忙',
        '没问题',
        false
      );
      expect(result.valid).toBe(false);
    });

    it('应该阻止新截止日期早于原日期', () => {
      const today = new Date();
      const originalDueDate = new Date(today);
      originalDueDate.setDate(originalDueDate.getDate() + 14);
      const newDueDate = new Date(today);
      newDueDate.setDate(newDueDate.getDate() + 7);

      const result = BusinessRuleValidator.validateDelayRequest(
        VulnerabilityStatus.IN_PROGRESS,
        0,
        Severity.HIGH,
        originalDueDate,
        newDueDate,
        '需要协调多个团队进行测试，预计需要额外的时间',
        '期间将使用临时防护措施减少风险暴露',
        false
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('新的截止日期必须晚于原截止日期');
    });

    it('应该阻止超过最大延期次数', () => {
      const today = new Date();
      const originalDueDate = new Date(today);
      originalDueDate.setDate(originalDueDate.getDate() + 14);
      const newDueDate = new Date(today);
      newDueDate.setDate(newDueDate.getDate() + 30);

      const result = BusinessRuleValidator.validateDelayRequest(
        VulnerabilityStatus.IN_PROGRESS,
        3,
        Severity.HIGH,
        originalDueDate,
        newDueDate,
        '需要协调多个团队进行测试，预计需要额外的时间',
        '期间将使用临时防护措施减少风险暴露',
        false
      );
      expect(result.valid).toBe(false);
    });

    it('应该阻止高危漏洞延期超过7天', () => {
      const today = new Date();
      const originalDueDate = new Date(today);
      originalDueDate.setDate(originalDueDate.getDate() + 7);
      const newDueDate = new Date(today);
      newDueDate.setDate(newDueDate.getDate() + 30);

      const result = BusinessRuleValidator.validateDelayRequest(
        VulnerabilityStatus.IN_PROGRESS,
        0,
        Severity.CRITICAL,
        originalDueDate,
        newDueDate,
        '需要协调多个团队进行测试，预计需要额外的时间',
        '期间将使用临时防护措施减少风险暴露',
        false
      );
      expect(result.valid).toBe(false);
    });

    it('应该对高危漏洞延期超过3天发出风险警告', () => {
      const today = new Date();
      const originalDueDate = new Date(today);
      originalDueDate.setDate(originalDueDate.getDate() + 7);
      const newDueDate = new Date(today);
      newDueDate.setDate(newDueDate.getDate() + 11);

      const result = BusinessRuleValidator.validateDelayRequest(
        VulnerabilityStatus.IN_PROGRESS,
        0,
        Severity.CRITICAL,
        originalDueDate,
        newDueDate,
        '需要协调多个团队进行测试，预计需要额外的时间',
        '期间将使用临时防护措施和监控机制来减少风险暴露',
        false
      );
      expect(result.valid).toBe(true);
      expect(result.additionalRisk).toBe(RiskLevel.HIGH);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('应该阻止 NEW 状态的漏洞申请延期', () => {
      const today = new Date();
      const originalDueDate = new Date(today);
      originalDueDate.setDate(originalDueDate.getDate() + 14);
      const newDueDate = new Date(today);
      newDueDate.setDate(newDueDate.getDate() + 30);

      const result = BusinessRuleValidator.validateDelayRequest(
        VulnerabilityStatus.NEW,
        0,
        Severity.HIGH,
        originalDueDate,
        newDueDate,
        '需要协调多个团队进行测试，预计需要额外的时间',
        '期间将使用临时防护措施减少风险暴露',
        false
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('calculateRepairWindow', () => {
    it('应该为高危漏洞计算7天修复窗口', () => {
      const today = new Date('2024-01-01');
      const result = BusinessRuleValidator.calculateRepairWindow(Severity.CRITICAL, today);
      expect(result.recommendedDays).toBe(7);
      expect(result.dueDate.toISOString()).toBe(new Date('2024-01-08').toISOString());
      expect(result.description).toBe('高危漏洞：7天内必须修复');
    });

    it('应该为中高危漏洞计算14天修复窗口', () => {
      const today = new Date('2024-01-01');
      const result = BusinessRuleValidator.calculateRepairWindow(Severity.HIGH, today);
      expect(result.recommendedDays).toBe(14);
      expect(result.dueDate.toISOString()).toBe(new Date('2024-01-15').toISOString());
      expect(result.description).toBe('中高危漏洞：14天内必须修复');
    });

    it('应该为中危漏洞计算30天修复窗口', () => {
      const today = new Date('2024-01-01');
      const result = BusinessRuleValidator.calculateRepairWindow(Severity.MEDIUM, today);
      expect(result.recommendedDays).toBe(30);
      expect(result.description).toBe('中危漏洞：30天内必须修复');
    });

    it('应该为低危漏洞计算90天修复窗口', () => {
      const today = new Date('2024-01-01');
      const result = BusinessRuleValidator.calculateRepairWindow(Severity.LOW, today);
      expect(result.recommendedDays).toBe(90);
      expect(result.description).toBe('低危漏洞：90天内修复');
    });
  });

  describe('checkBatchConsistency', () => {
    it('应该检测已上线批次中未完成的漏洞', () => {
      const result = BusinessRuleValidator.checkBatchConsistency(
        'DEPLOYED',
        [
          { status: VulnerabilityStatus.DEPLOYED },
          { status: VulnerabilityStatus.FIXED },
          { status: VulnerabilityStatus.IN_PROGRESS }
        ]
      );
      expect(result.consistent).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('仍有');
      expect(result.issues[0]).toContain('个漏洞未上线');
    });

    it('应该检测计划中批次已经开始处理的漏洞', () => {
      const result = BusinessRuleValidator.checkBatchConsistency(
        'PLANNED',
        [
          { status: VulnerabilityStatus.NEW },
          { status: VulnerabilityStatus.ASSIGNED },
          { status: VulnerabilityStatus.IN_PROGRESS }
        ]
      );
      expect(result.consistent).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('应该确认一致的批次状态', () => {
      const result = BusinessRuleValidator.checkBatchConsistency(
        'DEPLOYED',
        [
          { status: VulnerabilityStatus.DEPLOYED },
          { status: VulnerabilityStatus.CLOSED },
          { status: VulnerabilityStatus.CLOSED }
        ]
      );
      expect(result.consistent).toBe(true);
      expect(result.issues.length).toBe(0);
    });
  });

  describe('validateRepeatAssignment', () => {
    it('应该检测重复分配', () => {
      const existingAssignments = [
        { vulnerabilityId: 'vuln-1', assigneeId: 'user-123', isActive: true },
        { vulnerabilityId: 'vuln-2', assigneeId: 'user-456', isActive: true }
      ];

      const result = BusinessRuleValidator.validateRepeatAssignment(
        'vuln-1',
        'user-123',
        existingAssignments
      );

      expect(result.isRepeat).toBe(true);
      expect(result.lastAssignment).toBeDefined();
      expect(result.lastAssignment?.assigneeId).toBe('user-123');
    });

    it('应该返回非重复分配', () => {
      const existingAssignments = [
        { vulnerabilityId: 'vuln-1', assigneeId: 'user-123', isActive: true },
        { vulnerabilityId: 'vuln-2', assigneeId: 'user-456', isActive: true }
      ];

      const result = BusinessRuleValidator.validateRepeatAssignment(
        'vuln-1',
        'user-789',
        existingAssignments
      );

      expect(result.isRepeat).toBe(false);
      expect(result.lastAssignment).toBeUndefined();
    });
  });
});
