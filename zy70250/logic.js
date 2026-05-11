const PriorityEngine = {
  MAX_SCORE: 26,

  getRiskMultiplier(facilityType) {
    const type = FACILITY_TYPES.find(t => t.value === facilityType);
    return type ? type.riskMultiplier : 1.0;
  },

  getDamageScore(damageLevel) {
    const level = DAMAGE_LEVELS.find(l => l.value === damageLevel);
    return level ? level.score : 0;
  },

  calculatePopularityIndex(popularityRecords, allRecords) {
    if (!popularityRecords || popularityRecords.length === 0) {
      return 0;
    }

    const avgUsage = popularityRecords.reduce((sum, r) => sum + (r.usageCount || 0), 0) / popularityRecords.length;

    let maxUsage = 0;
    if (allRecords && allRecords.length > 0) {
      maxUsage = Math.max(...allRecords.map(r => r.usageCount || 0));
    }

    if (maxUsage === 0) return 0;

    const recentRatio = popularityRecords.slice(-7).reduce((sum, r) => sum + (r.usageCount || 0), 0) /
      (popularityRecords.reduce((sum, r) => sum + (r.usageCount || 0), 0) || 1);

    const peakBonus = popularityRecords.reduce((sum, r) => sum + (r.peakRatio || 0.5), 0) / popularityRecords.length;

    const index = (avgUsage / maxUsage) * 10 * (0.7 + 0.3 * recentRatio) * (0.8 + 0.4 * peakBonus);
    return Math.min(10, Math.max(0, index));
  },

  calculateRiskScore(facility) {
    if (!facility) return 0;

    const typeMultiplier = this.getRiskMultiplier(facility.type);
    const baseRisk = facility.baseRisk !== undefined ? facility.baseRisk : 1.0;

    return typeMultiplier * baseRisk * 4;
  },

  calculatePriorityBreakdown(facility, damage, dataStore) {
    const result = {
      input: {
        facilityType: facility ? facility.type : 'unknown',
        damageLevel: damage ? damage.level : 0,
        popularityRecords: 0
      },
      components: {
        damage: { rawScore: 0, weightedScore: 0, weight: PRIORITY_WEIGHTS.damage },
        popularity: { index: 0, weightedScore: 0, weight: PRIORITY_WEIGHTS.popularity },
        risk: { riskMultiplier: 0, riskScore: 0, weightedScore: 0, weight: PRIORITY_WEIGHTS.risk }
      },
      total: 0,
      normalized: 0
    };

    if (damage) {
      const damageScore = this.getDamageScore(damage.level);
      result.components.damage.rawScore = damageScore;
      result.components.damage.weightedScore = damageScore * PRIORITY_WEIGHTS.damage;
      result.input.damageLevel = damage.level;
    }

    if (facility && dataStore) {
      const popularityRecords = dataStore.getPopularityByFacility(facility.id, 30);
      const allRecords = dataStore.getPopularityRecords();
      result.input.popularityRecords = popularityRecords.length;

      const popularityIndex = this.calculatePopularityIndex(popularityRecords, allRecords);
      result.components.popularity.index = popularityIndex;
      result.components.popularity.weightedScore = popularityIndex * PRIORITY_WEIGHTS.popularity;

      const riskScore = this.calculateRiskScore(facility);
      result.components.risk.riskMultiplier = this.getRiskMultiplier(facility.type);
      result.components.risk.riskScore = riskScore;
      result.components.risk.weightedScore = riskScore * PRIORITY_WEIGHTS.risk;

      result.input.facilityType = facility.type;
    }

    result.total = result.components.damage.weightedScore +
      result.components.popularity.weightedScore +
      result.components.risk.weightedScore;

    result.normalized = Math.round((result.total / this.MAX_SCORE) * 100);

    result.category = this.getPriorityCategory(result.total);

    return result;
  },

  getPriorityCategory(score) {
    if (score >= 18) return 'critical';
    if (score >= 13) return 'high';
    if (score >= 8) return 'medium';
    return 'low';
  },

  getPriorityLabel(score) {
    const category = this.getPriorityCategory(score);
    const labels = {
      critical: '紧急',
      high: '高优先级',
      medium: '中优先级',
      low: '低优先级'
    };
    return labels[category] || '低优先级';
  },

  getPriorityBadgeClass(score) {
    const category = this.getPriorityCategory(score);
    return `priority-${category}`;
  },

  recalculateAllPriorities() {
    const tasks = DataStore.getRepairTasks();
    const updated = [];

    tasks.forEach(task => {
      if (task.status === 'done') return;

      const facility = DataStore.getFacilityById(task.facilityId);
      const damage = DataStore.getDamageReportById(task.damageId);

      if (facility && damage) {
        const breakdown = this.calculatePriorityBreakdown(facility, damage, DataStore);
        DataStore.updateRepairTask(task.id, {
          priority: breakdown.total,
          priorityBreakdown: breakdown
        });
        updated.push(task.id);
      }
    });

    return updated;
  },

  createRepairTaskForDamage(damageId) {
    const damage = DataStore.getDamageReportById(damageId);
    if (!damage) {
      return { success: false, error: '破损记录不存在' };
    }

    const existing = DataStore.getRepairTaskByDamageId(damageId);
    if (existing) {
      return { success: false, error: '该破损记录已有对应维修任务' };
    }

    const facility = DataStore.getFacilityById(damage.facilityId);
    if (!facility) {
      return { success: false, error: '关联的设施不存在' };
    }

    const breakdown = this.calculatePriorityBreakdown(facility, damage, DataStore);

    const task = DataStore.addRepairTask({
      facilityId: damage.facilityId,
      damageId: damage.id,
      priority: breakdown.total,
      priorityBreakdown: breakdown,
      status: 'pending'
    });

    return { success: true, task };
  },

  getTasksSortedByPriority(filter = {}) {
    let tasks = DataStore.getRepairTasks();

    if (filter.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    if (filter.facilityType) {
      const facilities = DataStore.getFacilities().filter(f => f.type === filter.facilityType);
      const facilityIds = new Set(facilities.map(f => f.id));
      tasks = tasks.filter(t => facilityIds.has(t.facilityId));
    }

    if (filter.minPriority !== undefined) {
      tasks = tasks.filter(t => t.priority >= filter.minPriority);
    }

    if (filter.search) {
      const search = filter.search.toLowerCase();
      tasks = tasks.filter(t => {
        const facility = DataStore.getFacilityById(t.facilityId);
        if (!facility) return false;
        return facility.name.toLowerCase().includes(search) ||
          facility.location.toLowerCase().includes(search);
      });
    }

    return tasks.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  },

  advanceTaskStatus(taskId) {
    const task = DataStore.getRepairTaskById(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }

    const currentStatus = TASK_STATUSES.find(s => s.value === task.status);
    if (!currentStatus || !currentStatus.next) {
      return { success: false, error: '当前状态无法继续推进' };
    }

    const newStatus = currentStatus.next;

    if (newStatus === 'done') {
      DataStore.resolveDamageReport(task.damageId);
    }

    const updated = DataStore.updateRepairTask(taskId, {
      status: newStatus,
      statusLog: [
        ...(task.statusLog || []),
        {
          from: task.status,
          to: newStatus,
          at: new Date().toISOString()
        }
      ]
    });

    return { success: true, task: updated };
  }
};

const TestCases = [
  {
    id: 'rule_damage_weight',
    title: '规则1: 破损等级占40%权重',
    description: '破损等级的权重最高，反映安全第一原则',
    run: () => {
      const facility = {
        id: 'test_f1',
        type: 'platform',
        baseRisk: 1.0
      };

      const damageMinor = { id: 'test_d1', level: 1 };
      const damageDanger = { id: 'test_d2', level: 4 };

      const mockStore = {
        getPopularityByFacility: () => [],
        getPopularityRecords: () => []
      };

      const b1 = PriorityEngine.calculatePriorityBreakdown(facility, damageMinor, mockStore);
      const b2 = PriorityEngine.calculatePriorityBreakdown(facility, damageDanger, mockStore);

      const damageDiff = b2.components.damage.rawScore - b1.components.damage.rawScore;
      const expectedDamageWeight = PRIORITY_WEIGHTS.damage;

      const passes = (
        b1.components.damage.weight === expectedDamageWeight &&
        b1.components.damage.weightedScore === 4 * expectedDamageWeight &&
        b2.components.damage.weightedScore === 16 * expectedDamageWeight &&
        damageDiff === 12
      );

      return {
        passes,
        expected: JSON.stringify({
          damageWeight: expectedDamageWeight,
          minDamageScore: 4,
          maxDamageScore: 16,
          expectedDiff: 12
        }, null, 2),
        actual: JSON.stringify({
          minBreakdown: b1.components.damage,
          maxBreakdown: b2.components.damage,
          actualDiff: damageDiff
        }, null, 2)
      };
    }
  },
  {
    id: 'rule_popularity_weight',
    title: '规则2: 使用热度占30%权重',
    description: '高热度设施的破损优先级更高',
    run: () => {
      const facility = {
        id: 'test_f1',
        type: 'platform',
        baseRisk: 1.0
      };

      const damage = { id: 'test_d1', level: 2 };

      const popularRecords = Array.from({ length: 7 }, (_, i) => ({
        facilityId: 'test_f1',
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        usageCount: 80 + i,
        peakRatio: 0.9
      }));

      const unpopularRecords = Array.from({ length: 7 }, (_, i) => ({
        facilityId: 'test_f1',
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        usageCount: 5 + i,
        peakRatio: 0.1
      }));

      const allRecords = [...popularRecords, ...unpopularRecords];

      const mockStorePopular = {
        getPopularityByFacility: () => popularRecords,
        getPopularityRecords: () => allRecords
      };

      const mockStoreUnpopular = {
        getPopularityByFacility: () => unpopularRecords,
        getPopularityRecords: () => allRecords
      };

      const bPopular = PriorityEngine.calculatePriorityBreakdown(facility, damage, mockStorePopular);
      const bUnpopular = PriorityEngine.calculatePriorityBreakdown(facility, damage, mockStoreUnpopular);

      const passes = (
        bPopular.components.popularity.weight === PRIORITY_WEIGHTS.popularity &&
        bPopular.components.popularity.weightedScore > bUnpopular.components.popularity.weightedScore &&
        bPopular.total > bUnpopular.total
      );

      return {
        passes,
        expected: JSON.stringify({
          popularityWeight: PRIORITY_WEIGHTS.popularity,
          expectedComparison: 'popular > unpopular'
        }, null, 2),
        actual: JSON.stringify({
          popular: { index: bPopular.components.popularity.index, weighted: bPopular.components.popularity.weightedScore, total: bPopular.total },
          unpopular: { index: bUnpopular.components.popularity.index, weighted: bUnpopular.components.popularity.weightedScore, total: bUnpopular.total }
        }, null, 2)
      };
    }
  },
  {
    id: 'rule_risk_weight',
    title: '规则3: 设施风险系数占30%权重',
    description: '高风险设施（如U池）的破损优先级更高',
    run: () => {
      const damage = { id: 'test_d1', level: 2 };

      const highRiskFacility = { id: 'test_hr', type: 'halfpipe', baseRisk: 1.0 };
      const lowRiskFacility = { id: 'test_lr', type: 'resting', baseRisk: 1.0 };

      const mockStore = {
        getPopularityByFacility: () => [],
        getPopularityRecords: () => []
      };

      const bHigh = PriorityEngine.calculatePriorityBreakdown(highRiskFacility, damage, mockStore);
      const bLow = PriorityEngine.calculatePriorityBreakdown(lowRiskFacility, damage, mockStore);

      const highRiskMult = PriorityEngine.getRiskMultiplier('halfpipe');
      const lowRiskMult = PriorityEngine.getRiskMultiplier('resting');

      const passes = (
        bHigh.components.risk.weight === PRIORITY_WEIGHTS.risk &&
        highRiskMult > lowRiskMult &&
        bHigh.components.risk.riskScore > bLow.components.risk.riskScore &&
        bHigh.total > bLow.total
      );

      return {
        passes,
        expected: JSON.stringify({
          riskWeight: PRIORITY_WEIGHTS.risk,
          halfpipeMultiplier: highRiskMult,
          restingMultiplier: lowRiskMult,
          expectedComparison: 'halfpipe > resting'
        }, null, 2),
        actual: JSON.stringify({
          halfpipe: { multiplier: bHigh.components.risk.riskMultiplier, riskScore: bHigh.components.risk.riskScore, total: bHigh.total },
          resting: { multiplier: bLow.components.risk.riskMultiplier, riskScore: bLow.components.risk.riskScore, total: bLow.total }
        }, null, 2)
      };
    }
  },
  {
    id: 'rule_priority_categories',
    title: '规则4: 优先级分类正确',
    description: '分数区间映射到正确的优先级标签',
    run: () => {
      const testCases = [
        { score: 20, expectedCategory: 'critical', expectedLabel: '紧急' },
        { score: 15, expectedCategory: 'high', expectedLabel: '高优先级' },
        { score: 10, expectedCategory: 'medium', expectedLabel: '中优先级' },
        { score: 5, expectedCategory: 'low', expectedLabel: '低优先级' }
      ];

      const results = testCases.map(tc => ({
        input: tc,
        category: PriorityEngine.getPriorityCategory(tc.score),
        label: PriorityEngine.getPriorityLabel(tc.score),
        pass: PriorityEngine.getPriorityCategory(tc.score) === tc.expectedCategory &&
          PriorityEngine.getPriorityLabel(tc.score) === tc.expectedLabel
      }));

      const passes = results.every(r => r.pass);

      return {
        passes,
        expected: JSON.stringify(testCases, null, 2),
        actual: JSON.stringify(results, null, 2)
      };
    }
  },
  {
    id: 'rule_status_workflow',
    title: '规则5: 任务状态流转正确',
    description: '待评估 → 评估中 → 维修中 → 已完成',
    run: () => {
      const expectedWorkflow = ['pending', 'assessing', 'in-progress', 'done'];

      const facility = DataStore.addFacility({
        name: '测试设施',
        type: 'platform',
        location: '测试'
      });

      const damage = DataStore.addDamageReport({
        facilityId: facility.id,
        level: 1,
        category: '表面磨损',
        description: '测试'
      });

      const breakdown = PriorityEngine.calculatePriorityBreakdown(facility, damage, DataStore);
      const task = DataStore.addRepairTask({
        facilityId: facility.id,
        damageId: damage.id,
        priority: breakdown.total,
        priorityBreakdown: breakdown
      });

      let currentTask = task;
      let step = 0;
      const actualWorkflow = [currentTask.status];

      while (true) {
        const result = PriorityEngine.advanceTaskStatus(currentTask.id);
        if (!result.success) break;
        currentTask = result.task;
        actualWorkflow.push(currentTask.status);
        step++;
        if (step > 10) break;
      }

      const passes = JSON.stringify(actualWorkflow) === JSON.stringify(expectedWorkflow);

      return {
        passes,
        expected: JSON.stringify(expectedWorkflow),
        actual: JSON.stringify(actualWorkflow)
      };
    }
  },
  {
    id: 'rule_validation_strict',
    title: '规则6: 脏数据进入问题列表',
    description: '无效数据不静默丢弃，记录错误和来源',
    run: () => {
      const initialProblemCount = DataStore.getProblems().length;

      const invalidData = {
        facilities: [
          { name: '', type: 'invalid_type', location: 'test' },
          { name: '有效设施', type: 'platform', location: '东区' }
        ]
      };

      const result = DataStore.importAll(invalidData, 'rule_validation_test');

      const finalProblemCount = DataStore.getProblems().length;

      const passes = (
        result.stats.facilities.imported === 1 &&
        result.stats.facilities.failed === 1 &&
        finalProblemCount > initialProblemCount
      );

      return {
        passes,
        expected: JSON.stringify({
          expectedImported: 1,
          expectedFailed: 1,
          expectedProblemsIncrease: '> 0'
        }, null, 2),
        actual: JSON.stringify({
          actualImported: result.stats.facilities.imported,
          actualFailed: result.stats.facilities.failed,
          initialProblems: initialProblemCount,
          finalProblems: finalProblemCount
        }, null, 2)
      };
    }
  }
];

function runAllTests() {
  return TestCases.map(tc => {
    try {
      const result = tc.run();
      return {
        ...tc,
        passed: result.passes,
        expected: result.expected,
        actual: result.actual
      };
    } catch (e) {
      return {
        ...tc,
        passed: false,
        expected: '无异常',
        actual: `异常: ${e.message}\n${e.stack}`
      };
    }
  });
}
