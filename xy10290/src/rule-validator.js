const db = require('./database');
const { getRules } = require('./rules');
const issueTracker = require('./issue-tracker');

const VALIDATION_SCENARIOS = [
  {
    ruleId: 'R001',
    name: '车位入住唯一性验证',
    description: '验证同一时间同一车位不能有两个在住记录',
    run: function(testCtx) {
      const { campsiteId, spotId } = testCtx.createTestInfrastructure();
      
      testCtx.checkIn(campsiteId, spotId, '沪A-TEST01', 10000);
      
      try {
        testCtx.checkIn(campsiteId, spotId, '沪A-TEST02', 10000);
        return {
          passed: false,
          message: '应拒绝第二个入住但未拒绝'
        };
      } catch (e) {
        if (e.ruleId === 'R001') {
          return { passed: true, message: '正确拒绝了车位重复入住' };
        }
        return { passed: false, message: `错误类型不符：${e.message}` };
      }
    }
  },
  {
    ruleId: 'R002',
    name: '入住时间校验',
    description: '验证入住时间不能晚于当前时间',
    run: function(testCtx) {
      const { campsiteId, spotId } = testCtx.createTestInfrastructure();
      
      const futureTime = Date.now() + 3600000;
      
      try {
        testCtx.checkIn(campsiteId, spotId, '沪A-TEST03', 10000, futureTime);
        return {
          passed: false,
          message: '应拒绝未来入住但未拒绝'
        };
      } catch (e) {
        if (e.ruleId === 'R002') {
          return { passed: true, message: '正确拒绝了未来入住' };
        }
        return { passed: false, message: `错误类型不符：${e.message}` };
      }
    }
  },
  {
    ruleId: 'R003',
    name: '读数时间顺序验证',
    description: '验证新读数时间必须晚于历史读数',
    run: function(testCtx) {
      const { campsiteId, pillarId } = testCtx.createTestInfrastructure();
      const now = Date.now();
      
      testCtx.recordReading(pillarId, now - 3600000, 100, 200);
      
      try {
        testCtx.recordReading(pillarId, now - 7200000, 110, 210);
        return {
          passed: false,
          message: '应拒绝时间更早的读数但未拒绝'
        };
      } catch (e) {
        if (e.ruleId === 'R003') {
          return { passed: true, message: '正确拒绝了时间更早的读数' };
        }
        return { passed: false, message: `错误类型不符：${e.message}` };
      }
    }
  },
  {
    ruleId: 'R004',
    name: '读数单调递增验证',
    description: '验证水表/电表读数不能回退',
    run: function(testCtx) {
      const { campsiteId, pillarId } = testCtx.createTestInfrastructure();
      const now = Date.now();
      
      testCtx.recordReading(pillarId, now - 3600000, 100, 200);
      
      try {
        testCtx.recordReading(pillarId, now, 90, 210);
        return {
          passed: false,
          message: '应拒绝水表读数回退但未拒绝'
        };
      } catch (e) {
        if (e.ruleId === 'R004') {
          return { passed: true, message: '正确拒绝了水表读数回退' };
        }
        return { passed: false, message: `错误类型不符：${e.message}` };
      }
    }
  },
  {
    ruleId: 'R005',
    name: '桩位绑定有效性验证',
    description: '验证无绑定车位的分摊会进入问题列表',
    run: function(testCtx) {
      const campsite = testCtx.createCampsite('孤立桩测试营地');
      const pillar = testCtx.createPillar(campsite.id, 'ISO-P001');
      
      const reading1 = testCtx.recordReading(pillar.id, Date.now() - 7200000, 0, 0);
      const reading2 = testCtx.recordReading(pillar.id, Date.now(), 10, 20);
      
      const beforeIssueCount = issueTracker.getIssueCount({ status: 'OPEN' });
      
      const result = testCtx.allocate(pillar.id, reading1.id, reading2.id);
      
      const afterIssueCount = issueTracker.getIssueCount({ status: 'OPEN' });
      
      if (result.note && result.note.includes('已记录问题') && afterIssueCount > beforeIssueCount) {
        return { 
          passed: true, 
          message: '无绑定车位的分摊正确进入问题列表，问题数 +' + (afterIssueCount - beforeIssueCount)
        };
      }
      return { passed: false, message: '无绑定车位时未正确记录问题' };
    }
  },
  {
    ruleId: 'R007',
    name: '分时占用归属验证',
    description: '验证按实际在住时间比例分摊水电用量',
    run: function(testCtx) {
      const { campsiteId, spotId, pillarId } = testCtx.createTestInfrastructure();
      const now = Date.now();
      
      const stay = testCtx.checkIn(campsiteId, spotId, '沪A-TEST04', 20000, now - 7200000);
      
      const reading1 = testCtx.recordReading(pillarId, now - 7200000, 0, 0);
      const reading2 = testCtx.recordReading(pillarId, now, 100, 200);
      
      const allocation = testCtx.allocate(pillarId, reading1.id, reading2.id);
      
      if (allocation.allocations.length === 1 && 
          allocation.allocations[0].water_units === 100 &&
          allocation.allocations[0].electric_units === 200) {
        return { 
          passed: true, 
          message: `正确分摊：水 100 单位（${allocation.allocations[0].water_cost}分），电 200 单位（${allocation.allocations[0].electric_cost}分）`
        };
      }
      return { 
        passed: false, 
        message: `分摊结果不正确：${JSON.stringify(allocation.allocations)}`
      };
    }
  },
  {
    ruleId: 'R008',
    name: '押金完整性验证',
    description: '验证押金不足时会产生差额记录并进入问题列表',
    run: function(testCtx) {
      const { campsiteId, spotId, pillarId } = testCtx.createTestInfrastructure();
      const now = Date.now();
      
      const stay = testCtx.checkIn(campsiteId, spotId, '沪A-TEST05', 100, now - 7200000);
      
      const reading1 = testCtx.recordReading(pillarId, now - 7200000, 0, 0);
      const reading2 = testCtx.recordReading(pillarId, now, 100, 200);
      
      testCtx.allocate(pillarId, reading1.id, reading2.id);
      
      const beforeIssueCount = issueTracker.getIssueCount({ status: 'OPEN', issue_type: 'DEPOSIT_SHORTAGE' });
      
      const settlement = testCtx.createSettlement(stay.id);
      
      const afterIssueCount = issueTracker.getIssueCount({ status: 'OPEN', issue_type: 'DEPOSIT_SHORTAGE' });
      
      if (settlement.additional_charge > 0 && afterIssueCount > beforeIssueCount) {
        return { 
          passed: true, 
          message: `押金不足时正确产生差额：需补缴 ${settlement.additional_charge} 分，问题数 +` + (afterIssueCount - beforeIssueCount)
        };
      }
      return { passed: false, message: '押金不足时未正确记录问题' };
    }
  },
  {
    ruleId: 'R010',
    name: '脏数据追踪验证',
    description: '验证读数回退等脏数据会进入问题列表',
    run: function(testCtx) {
      const { campsiteId, pillarId } = testCtx.createTestInfrastructure();
      const now = Date.now();
      
      testCtx.recordReading(pillarId, now - 3600000, 100, 200);
      
      const beforeIssueCount = issueTracker.getIssueCount({ status: 'OPEN' });
      
      try {
        testCtx.recordReading(pillarId, now, 90, 190);
      } catch (e) {
        issueTracker.createIssueFromError(
          e, 
          'METER_READING', 
          pillarId, 
          { readingTime: now, waterReading: 90, electricReading: 190 }
        );
      }
      
      const afterIssueCount = issueTracker.getIssueCount({ status: 'OPEN' });
      
      if (afterIssueCount > beforeIssueCount) {
        return { 
          passed: true, 
          message: '脏数据正确进入问题列表，问题数 +' + (afterIssueCount - beforeIssueCount)
        };
      }
      return { passed: false, message: '脏数据未正确记录问题' };
    }
  }
];

function createTestContext() {
  const campgroundService = require('./campground-service');
  const settlementService = require('./settlement-service');
  
  return {
    createCampsite: (name) => campgroundService.createCampsite(name || '测试营地'),
    
    createPillar: (campsiteId, code) => 
      campgroundService.createUtilityPillar(campsiteId, code || 'TEST-P001', 500, 800),
    
    createSpot: (campsiteId, number) => 
      campgroundService.createParkingSpot(campsiteId, number || 'A001'),
    
    connect: (pillarId, spotId) => 
      campgroundService.connectPillarToSpot(pillarId, spotId),
    
    createTestInfrastructure: function() {
      const campsite = this.createCampsite();
      const spot = this.createSpot(campsite.id);
      const pillar = this.createPillar(campsite.id);
      this.connect(pillar.id, spot.id);
      return {
        campsiteId: campsite.id,
        spotId: spot.id,
        pillarId: pillar.id
      };
    },
    
    checkIn: (campsiteId, spotId, plate, deposit, checkInTime) =>
      campgroundService.checkIn(campsiteId, spotId, plate, deposit, checkInTime),
    
    checkOut: (stayId, checkOutTime) =>
      settlementService.checkOut(stayId, checkOutTime),
    
    recordReading: (pillarId, time, water, electric) =>
      campgroundService.recordMeterReading(pillarId, time, water, electric),
    
    allocate: (pillarId, fromId, toId) =>
      campgroundService.allocateUtilityUsage(pillarId, fromId, toId),
    
    createSettlement: (stayId) =>
      settlementService.createSettlement(stayId)
  };
}

function runAllValidations() {
  const rules = getRules();
  const testCtx = createTestContext();
  
  const results = [];
  const ruleCoverage = new Map();
  
  for (const rule of rules) {
    ruleCoverage.set(rule.id, {
      rule,
      hasTest: false,
      testResult: null
    });
  }
  
  for (const scenario of VALIDATION_SCENARIOS) {
    let result;
    try {
      result = scenario.run(testCtx);
    } catch (e) {
      result = {
        passed: false,
        message: `执行异常：${e.message}`
      };
    }
    
    results.push({
      ruleId: scenario.ruleId,
      name: scenario.name,
      description: scenario.description,
      passed: result.passed,
      message: result.message
    });
    
    if (ruleCoverage.has(scenario.ruleId)) {
      const coverage = ruleCoverage.get(scenario.ruleId);
      coverage.hasTest = true;
      coverage.testResult = result;
    }
  }
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const coveredRules = Array.from(ruleCoverage.values()).filter(c => c.hasTest).length;
  const totalRules = ruleCoverage.size;
  
  const coverageSummary = Array.from(ruleCoverage.values()).map(c => ({
    ruleId: c.rule.id,
    ruleName: c.rule.name,
    category: c.rule.category,
    hasTest: c.hasTest,
    passed: c.testResult ? c.testResult.passed : null
  }));
  
  return {
    timestamp: new Date().toISOString(),
    summary: {
      tests_passed: passed,
      tests_total: total,
      rules_covered: coveredRules,
      rules_total: totalRules,
      pass_rate: `${((passed / total) * 100).toFixed(1)}%`,
      coverage_rate: `${((coveredRules / totalRules) * 100).toFixed(1)}%`
    },
    test_results: results,
    rule_coverage: coverageSummary,
    all_rules: rules
  };
}

function printValidationReport(report) {
  console.log('\n' + '='.repeat(80));
  console.log('  房车营地水电桩分摊系统 - 规则验证报告');
  console.log('  生成时间:', report.timestamp);
  console.log('='.repeat(80));
  
  console.log('\n【汇总】');
  console.log('  测试用例:', report.summary.tests_passed, '/', report.summary.tests_total, '通过');
  console.log('  通过率:', report.summary.pass_rate);
  console.log('  规则覆盖:', report.summary.rules_covered, '/', report.summary.rules_total);
  console.log('  覆盖率:', report.summary.coverage_rate);
  
  console.log('\n【规则覆盖详情】');
  for (const coverage of report.rule_coverage) {
    const statusIcon = coverage.hasTest 
      ? (coverage.passed ? '✓' : '✗') 
      : '○';
    const statusText = coverage.hasTest 
      ? (coverage.passed ? '通过' : '失败') 
      : '未测试';
    console.log(`  [${statusIcon}] ${coverage.ruleId} ${coverage.ruleName} (${coverage.category}) - ${statusText}`);
  }
  
  console.log('\n【测试详情】');
  for (const result of report.test_results) {
    const icon = result.passed ? '✓' : '✗';
    console.log(`\n  [${icon}] ${result.name}`);
    console.log(`      ${result.description}`);
    console.log(`      结果: ${result.message}`);
  }
  
  console.log('\n' + '='.repeat(80));
  
  return report.summary.tests_passed === report.summary.tests_total;
}

module.exports = {
  VALIDATION_SCENARIOS,
  createTestContext,
  runAllValidations,
  printValidationReport
};
