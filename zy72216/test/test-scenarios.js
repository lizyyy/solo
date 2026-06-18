const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'data', 'reconciliation.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('🧹 清理旧数据库完成');
}

const { execSync } = require('child_process');
console.log('🔧 初始化数据库...');
execSync('node scripts/init-db.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('⏳ 等待数据库初始化完成...');

setTimeout(() => {
  const db = new sqlite3.Database(dbPath);
  const { STATUS, CHANGE_TYPE, FIELDS } = require('../utils/constants');
  const boundaryRules = require('../utils/boundary-rules');
  const CustodianRecord = require('../models/custodian-record');
  const ManualChangeLog = require('../models/manual-change-log');
  const StatusTransition = require('../models/status-transition');
  const ExRightScreenshot = require('../models/ex-right-screenshot');
  const ReconciliationNote = require('../models/reconciliation-note');
  const reconciliationService = require('../services/reconciliation-service');
  const unifiedDataService = require('../services/unified-data-service');

  let testResults = [];
  let testQueue = [];
  let currentTestIndex = 0;

  function test(name, fn, isAsync = false) {
    if (isAsync) {
      testResults.push({ name: 'pending' });
      const idx = testResults.length - 1;
      fn((err) => {
        if (err) {
          console.log(`❌ ${name}`);
          console.log(`   错误: ${err.message}`);
          testResults[idx] = { name, passed: false, error: err.message };
          runNext();
        } else {
          console.log(`✅ ${name}`);
          testResults[idx] = { name, passed: true };
          runNext();
        }
      });
    } else {
      try {
        fn();
        console.log(`✅ ${name}`);
        testResults.push({ name, passed: true });
        runNext();
      } catch (err) {
        console.log(`❌ ${name}`);
        console.log(`   错误: ${err.message}`);
        testResults.push({ name, passed: false, error: err.message });
        runNext();
      }
    }
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: 期望 ${expected}，实际 ${actual}`);
    }
  }

  function assertTrue(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function addTest(name, fn, isAsync = false) {
    testQueue.push({ name, fn, isAsync });
  }

  function runNext() {
    if (currentTestIndex < testQueue.length) {
      const t = testQueue[currentTestIndex];
      currentTestIndex++;
      test(t.name, t.fn, t.isAsync);
    } else {
      printResults();
    }
  }

  function printResults() {
    console.log('\n' + '═'.repeat(60));
    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;
    console.log(`  测试完成: ${passed}/${total} 通过`);
    console.log('═'.repeat(60) + '\n');

    if (passed < total) {
      console.log('❌ 失败的测试:');
      testResults.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
      db.close();
      process.exit(1);
    } else {
      console.log('🎉 所有测试通过！\n');
      console.log('💡 下一步:');
      console.log('   1. npm start    # 启动服务');
      console.log('   2. 打开 http://localhost:3000 访问前端界面');
      db.close();
      process.exit(0);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  私募持仓穿透核对 - 场景测试');
  console.log('═'.repeat(60) + '\n');

  let recordId = null;
  let batchId = null;

  console.log('📋 场景一：边界规则单元测试');
  console.log('─'.repeat(60));

  addTest('detectT1ToT2ManualChange - 相差1天应返回true', () => {
    const result = boundaryRules.detectT1ToT2ManualChange('2026-06-02', '2026-06-03');
    assertTrue(result, '相差1天应该检测为T+1→T+2');
  });

  addTest('detectT1ToT2ManualChange - 相差2天应返回false', () => {
    const result = boundaryRules.detectT1ToT2ManualChange('2026-06-02', '2026-06-04');
    assertTrue(!result, '相差2天不应该检测为T+1→T+2');
  });

  addTest('classifyChange - 到账日相差1天应为T1_TO_T2_MANUAL', () => {
    const result = boundaryRules.classifyChange(FIELDS.SETTLEMENT_DATE, '2026-06-02', '2026-06-03');
    assertEqual(result, CHANGE_TYPE.T1_TO_T2_MANUAL, '改动类型');
  });

  addTest('requiresManagerReview - T1_TO_T2_MANUAL应需要复核', () => {
    const result = boundaryRules.requiresManagerReview(CHANGE_TYPE.T1_TO_T2_MANUAL);
    assertTrue(result, 'T+1→T+2改动应该需要基金经理复核');
  });

  addTest('validateTransition - IMPORTED→SCREENSHOT_REVIEWED应允许', () => {
    const result = boundaryRules.validateTransition(STATUS.IMPORTED, STATUS.SCREENSHOT_REVIEWED);
    assertTrue(result, '应该允许从已导入流转到已补看截图');
  });

  addTest('validateTransition - IMPORTED→NORMAL应禁止', () => {
    const result = boundaryRules.validateTransition(STATUS.IMPORTED, STATUS.NORMAL);
    assertTrue(!result, '不应该允许从已导入直接到正常');
  });

  addTest('canFinalize - 有T+1→T+2改动且状态为PENDING不能标记正常', () => {
    const record = { has_manual_change: 1, change_type: CHANGE_TYPE.T1_TO_T2_MANUAL };
    const result = boundaryRules.canFinalize(STATUS.PENDING_MANAGER_REVIEW, record);
    assertTrue(!result, '待复核状态不能标记正常');
  });

  addTest('canFinalize - 有T+1→T+2改动且状态为MANAGER_APPROVED可以标记正常', () => {
    const record = { has_manual_change: 1, change_type: CHANGE_TYPE.T1_TO_T2_MANUAL };
    const result = boundaryRules.canFinalize(STATUS.MANAGER_APPROVED, record);
    assertTrue(result, '基金经理复核通过后可以标记正常');
  });

  addTest('getRevertTargetStatus - PENDING_MANAGER_REVIEW应回滚到SCREENSHOT_REVIEWED', () => {
    const result = boundaryRules.getRevertTargetStatus(STATUS.PENDING_MANAGER_REVIEW);
    assertEqual(result, STATUS.SCREENSHOT_REVIEWED, '回滚目标状态');
  });

  console.log('\n📋 场景二：完整三步流程 + T+1→T+2处理');
  console.log('─'.repeat(60));

  addTest('Step 1: 导入托管确认页（5条记录）', (done) => {
    const records = [
      {
        original_line_number: 1,
        fund_code: 'PF001',
        fund_name: '私募精选1号',
        security_code: '600519',
        security_name: '贵州茅台',
        settlement_date: '2026-06-02',
        quantity: 1000,
        amount: 1680000
      },
      {
        original_line_number: 2,
        fund_code: 'PF001',
        fund_name: '私募精选1号',
        security_code: '000858',
        security_name: '五粮液',
        settlement_date: '2026-06-02',
        quantity: 2000,
        amount: 320000
      },
      {
        original_line_number: 3,
        fund_code: 'PF002',
        fund_name: '私募成长2号',
        security_code: '300750',
        security_name: '宁德时代',
        settlement_date: '2026-06-02',
        quantity: 500,
        amount: 1025000
      },
      {
        original_line_number: 4,
        fund_code: 'PF002',
        fund_name: '私募成长2号',
        security_code: '002594',
        security_name: '比亚迪',
        settlement_date: '2026-06-02',
        quantity: 800,
        amount: 208000
      },
      {
        original_line_number: 5,
        fund_code: 'PF001',
        fund_name: '私募精选1号',
        security_code: '601318',
        security_name: '中国平安',
        settlement_date: '2026-06-02',
        quantity: 3000,
        amount: 150000
      }
    ];

    reconciliationService.importCustodianRecords(records, '阿芬', (err, result) => {
      if (err) return done(err);
      try {
        assertTrue(result.count === 5, '应该导入5条记录');
        assertTrue(result.batch_id.startsWith('BATCH-'), '批次号格式正确');
        batchId = result.batch_id;
        recordId = result.records[2].id;
        console.log(`   批次号: ${batchId}`);
        console.log(`   测试记录ID(宁德时代): ${recordId}`);
        done();
      } catch (e) { done(e); }
    });
  }, true);

  addTest('验证导入记录的原始行号保留', (done) => {
    CustodianRecord.getRecordById(recordId, (err, record) => {
      if (err) return done(err);
      try {
        assertEqual(record.original_line_number, 3, '原始行号应为3');
        assertEqual(record.original_settlement_date, '2026-06-02', '原始到账日应为2026-06-02');
        assertEqual(record.current_settlement_date, '2026-06-02', '当前到账日应与原始相同');
        assertEqual(record.status, STATUS.IMPORTED, '状态应为已导入');
        assertEqual(record.has_manual_change, 0, '不应有人工改动标记');
        done();
      } catch (e) { done(e); }
    });
  }, true);

  addTest('Step 2: 补看除权日截图，上传证据', (done) => {
    reconciliationService.uploadExRightScreenshot(
      recordId, '/uploads/ex-right-300750.png', '阿芬', '除权日截图显示T+2到账',
      (err, result) => {
        if (err) return done(err);
        try {
          assertTrue(result.screenshot_id > 0, '截图记录ID应有效');
          assertEqual(result.new_status, STATUS.SCREENSHOT_REVIEWED, '状态应为已补看截图');
          done();
        } catch (e) { done(e); }
      }
    );
  }, true);

  addTest('记录T+1→T+2手工改动（阿芬发现到账日应为T+2）', (done) => {
    reconciliationService.recordManualChange(
      recordId,
      FIELDS.SETTLEMENT_DATE,
      '2026-06-02',
      '2026-06-03',
      '除权日截图显示为T+2到账，托管确认页显示T+1有误',
      '阿芬',
      '/uploads/ex-right-300750.png',
      (err, result) => {
        if (err) return done(err);
        try {
          assertEqual(result.change_type, CHANGE_TYPE.T1_TO_T2_MANUAL, '改动类型应为T1_TO_T2_MANUAL');
          assertEqual(result.new_status, STATUS.PENDING_MANAGER_REVIEW, '状态应自动变为待基金经理复核');
          assertTrue(result.requires_review, '应该需要基金经理复核');
          console.log(`   ✅ 自动检测到T+1→T+2改动，已提交基金经理复核`);
          done();
        } catch (e) { done(e); }
      }
    );
  }, true);

  addTest('验证人工改动日志已记录', (done) => {
    ManualChangeLog.getLogsByRecordId(recordId, (err, logs) => {
      if (err) return done(err);
      try {
        assertTrue(logs.length === 1, '应该有1条改动日志');
        assertEqual(logs[0].field_name, FIELDS.SETTLEMENT_DATE, '改动字段应为到账日');
        assertEqual(logs[0].old_value, '2026-06-02', '原值应为2026-06-02');
        assertEqual(logs[0].new_value, '2026-06-03', '新值应为2026-06-03');
        assertEqual(logs[0].operator, '阿芬', '操作员应为阿芬');
        assertTrue(!!logs[0].evidence_screenshot, '应有证据截图');
        done();
      } catch (e) { done(e); }
    });
  }, true);

  addTest('验证记录已标记有人工改动', (done) => {
    CustodianRecord.getRecordById(recordId, (err, record) => {
      if (err) return done(err);
      try {
        assertEqual(record.has_manual_change, 1, '应标记有人工改动');
        assertEqual(record.change_type, CHANGE_TYPE.T1_TO_T2_MANUAL, '改动类型应为T1_TO_T2_MANUAL');
        assertEqual(record.current_settlement_date, '2026-06-03', '当前到账日应为2026-06-03');
        assertEqual(record.original_settlement_date, '2026-06-02', '原始到账日仍为2026-06-02');
        done();
      } catch (e) { done(e); }
    });
  }, true);

  addTest('验证状态流转历史', (done) => {
    StatusTransition.getTransitionsByRecordId(recordId, (err, transitions) => {
      if (err) return done(err);
      try {
        assertTrue(transitions.length >= 3, '至少应有3次状态流转');
        const statuses = transitions.map(t => t.to_status);
        assertTrue(statuses.includes(STATUS.IMPORTED), '应有已导入状态');
        assertTrue(statuses.includes(STATUS.SCREENSHOT_REVIEWED), '应有已补看截图状态');
        assertTrue(statuses.includes(STATUS.PENDING_MANAGER_REVIEW), '应有待复核状态');
        done();
      } catch (e) { done(e); }
    });
  }, true);

  addTest('❌ 尝试跳过复核直接标记正常 - 应该被拒绝', (done) => {
    reconciliationService.finalizeRecord(recordId, '阿芬', (err, result) => {
      try {
        assertTrue(!!err, '应该报错，不允许跳过复核直接标记正常');
        assertTrue(err.message.includes('不允许'), '错误信息应包含不允许');
        console.log(`   ✅ 正确阻止了跳过复核的操作: ${err.message}`);
        done();
      } catch (e) { done(e); }
    });
  }, true);

  addTest('Step 3: 更新对账说明', (done) => {
    reconciliationService.updateReconciliationNote(
      recordId,
      '托管确认页显示T+1，但除权日截图实际为T+2。已记录手工改动，待基金经理复核。',
      '阿芬',
      (err, result) => {
        if (err) return done(err);
        try {
          assertTrue(result.note_id > 0, '对账说明ID应有效');
          done();
        } catch (e) { done(e); }
      }
    );
  }, true);

  addTest('基金经理复核通过', (done) => {
    reconciliationService.managerReview(
      recordId,
      true,
      '情况属实，除权日截图确实显示T+2到账，同意调整。',
      '基金经理-张总',
      (err, result) => {
        if (err) return done(err);
        try {
          assertEqual(result.new_status, STATUS.MANAGER_APPROVED, '状态应为基金经理复核通过');
          console.log(`   ✅ 基金经理复核通过`);
          done();
        } catch (e) { done(e); }
      }
    );
  }, true);

  addTest('✅ 基金经理复核通过后，标记正常 - 应该成功', (done) => {
    reconciliationService.finalizeRecord(recordId, '阿芬', (err, result) => {
      if (err) return done(err);
      try {
        assertEqual(result.new_status, STATUS.NORMAL, '状态应为正常');
        console.log(`   ✅ 成功标记为正常`);
        done();
      } catch (e) { done(e); }
    });
  }, true);

  addTest('验证状态流转完整', (done) => {
    StatusTransition.getTransitionsByRecordId(recordId, (err, transitions) => {
      if (err) return done(err);
      try {
        console.log(`   完整状态流转:`);
        transitions.forEach(t => {
          console.log(`     ${t.operate_time} | ${t.operator}: ${t.from_status || '(初始)'} → ${t.to_status} | ${t.transition_reason}`);
        });
        assertTrue(transitions.length >= 5, '至少应有5次状态流转');
        done();
      } catch (e) { done(e); }
    });
  }, true);

  console.log('\n📋 场景三：数据一致性验证（三源同数）');
  console.log('─'.repeat(60));

  addTest('页面/API/导出读同一份数据', (done) => {
    unifiedDataService.getFullRecordById(recordId, (err, apiData) => {
      if (err) return done(err);
      unifiedDataService.getAllRecordsWithDetails((err, listData) => {
        if (err) return done(err);
        unifiedDataService.getExportData((err, exportData) => {
          if (err) return done(err);
          try {
            const listRecord = listData.find(r => r.id === recordId);
            const exportRecord = exportData.find(r => r['原始行号'] === 3 && r['基金代码'] === 'PF002');

            assertTrue(!!listRecord, '列表数据中应包含该记录');
            assertTrue(!!exportRecord, '导出数据中应包含该记录');

            assertEqual(exportRecord['原始到账日'], apiData.original_settlement_date, '导出原始到账日应与API一致');
            assertEqual(exportRecord['当前到账日'], apiData.current_settlement_date, '导出当前到账日应与API一致');
            assertEqual(exportRecord['是否人工改动'], '是', '导出应显示有人工改动');
            assertEqual(exportRecord['处理状态'], '正常', '导出状态应为正常');
            assertTrue(exportRecord['人工改动记录'].includes('T+1'), '导出应包含改动记录');
            assertTrue(exportRecord['人工改动记录'].includes('阿芬'), '导出应包含操作员');

            assertTrue(!!exportRecord['对账说明'] && exportRecord['对账说明'].length > 0, '导出对账说明不应为空');
            assertTrue(exportRecord['对账说明'].includes('托管确认页显示T+1'), '导出对账说明应包含内容');

            assertTrue(!!exportRecord['除权日截图'] && exportRecord['除权日截图'].url, '导出除权日截图链接不应为空');
            assertTrue(exportRecord['除权日截图'].url.includes('/uploads/'), '除权日截图链接应包含/uploads路径');
            assertTrue(exportRecord['除权日截图'].url.startsWith('http'), '除权日截图链接应为完整URL');

            assertTrue(!!exportRecord['人工改动证据截图'] && exportRecord['人工改动证据截图'].url, '导出人工改动证据截图链接不应为空');
            assertTrue(exportRecord['人工改动证据截图'].url.includes('/uploads/'), '人工改动证据截图链接应包含/uploads路径');
            assertTrue(exportRecord['人工改动证据截图'].url.startsWith('http'), '人工改动证据截图链接应为完整URL');

            assertTrue(!!exportRecord['状态流转历史'] && exportRecord['状态流转历史'].length > 0, '导出状态流转历史不应为空');
            assertTrue(exportRecord['状态流转历史'].includes('待基金经理复核'), '状态流转历史应包含待复核');
            assertTrue(exportRecord['状态流转历史'].includes('基金经理复核通过'), '状态流转历史应包含复核通过');

            assertTrue(Array.isArray(apiData.reconciliation_notes), 'API数据应包含reconciliation_notes数组');
            assertTrue(apiData.reconciliation_notes.length > 0, 'API数据对账说明不应为空');
            assertEqual(apiData.reconciliation_notes[0].note_content, exportRecord['对账说明'].split('; ')[0], 'API和导出的对账说明应一致');

            assertTrue(Array.isArray(listRecord.ex_right_screenshots), '列表数据应包含ex_right_screenshots数组');
            assertTrue(listRecord.ex_right_screenshots.length > 0, '列表数据除权日截图不应为空');
            assertTrue(!!listRecord.ex_right_screenshots[0].screenshot_url, '列表数据截图应包含完整URL');
            assertEqual(listRecord.ex_right_screenshots[0].screenshot_url, apiData.ex_right_screenshots[0].screenshot_url, '列表和API的截图URL应一致');

            assertTrue(Array.isArray(listRecord.status_transitions), '列表数据应包含status_transitions数组');
            assertTrue(listRecord.status_transitions.length >= 5, '列表数据状态流转不应为空');
            assertEqual(listRecord.status_transitions.length, apiData.status_transitions.length, '列表和API的状态流转条数应一致');

            assertTrue(Array.isArray(listRecord.change_logs), '列表数据应包含change_logs数组');
            assertTrue(listRecord.change_logs.length > 0, '列表数据人工改动日志不应为空');
            assertTrue(!!listRecord.change_logs[0].evidence_screenshot_url, '列表数据改动日志应包含证据截图URL');
            assertEqual(listRecord.change_logs[0].evidence_screenshot_url, apiData.change_logs[0].evidence_screenshot_url, '列表和API的证据截图URL应一致');

            console.log(`   ✅ 三源数据完全一致`);
            console.log(`      原始到账日: ${exportRecord['原始到账日']}`);
            console.log(`      当前到账日: ${exportRecord['当前到账日']}`);
            console.log(`      处理状态: ${exportRecord['处理状态']}`);
            console.log(`      人工改动记录: ${exportRecord['人工改动记录']}`);
            console.log(`      对账说明: ${exportRecord['对账说明']}`);
            console.log(`      除权日截图: ${exportRecord['除权日截图'].url}`);
            console.log(`      人工改动证据: ${exportRecord['人工改动证据截图'].url}`);
            console.log(`      状态流转历史: ${exportRecord['状态流转历史'].slice(0, 80)}...`);
            done();
          } catch (e) { done(e); }
        });
      });
    });
  }, true);

  console.log('\n📋 场景四：回滚机制验证');
  console.log('─'.repeat(60));

  addTest('回滚操作 - 从NORMAL回滚到MANAGER_APPROVED', (done) => {
    reconciliationService.revertRecord(
      recordId,
      '阿芬',
      '发现除权日截图看错了，实际是T+1，回滚操作',
      (err, result) => {
        if (err) return done(err);
        try {
          assertEqual(result.new_status, STATUS.MANAGER_APPROVED, '应回滚到基金经理复核通过');
          assertTrue(result.values_reverted, '数值应已恢复');
          console.log(`   ✅ 回滚成功，状态: NORMAL → MANAGER_APPROVED`);
          done();
        } catch (e) { done(e); }
      }
    );
  }, true);

  addTest('验证回滚后数据恢复', (done) => {
    CustodianRecord.getRecordById(recordId, (err, record) => {
      if (err) return done(err);
      try {
        assertEqual(record.current_settlement_date, '2026-06-02', '当前到账日应恢复为原始值');
        assertEqual(record.has_manual_change, 0, '人工改动标记应清除');
        assertEqual(record.change_type, null, '改动类型应清除');
        console.log(`   ✅ 数据已恢复: 当前到账日 = ${record.current_settlement_date}`);
        done();
      } catch (e) { done(e); }
    });
  }, true);

  addTest('验证历史日志仍然保留', (done) => {
    ManualChangeLog.getLogsByRecordId(recordId, (err, logs) => {
      if (err) return done(err);
      try {
        assertTrue(logs.length >= 1, '历史改动日志不应被删除');
        console.log(`   ✅ 历史日志保留: ${logs.length} 条改动记录`);
        done();
      } catch (e) { done(e); }
    });
  }, true);

  console.log('\n📋 场景五：边界保护验证');
  console.log('─'.repeat(60));

  addTest('验证不允许的状态流转被拒绝', (done) => {
    reconciliationService.transitionStatus(
      recordId,
      STATUS.MANAGER_APPROVED,
      STATUS.IMPORTED,
      '测试不允许的状态流转',
      '测试员',
      (err, result) => {
        try {
          assertTrue(!!err, '应该报错');
          assertTrue(err.message.includes('不允许'), '应提示不允许的状态流转');
          console.log(`   ✅ 状态流转校验工作: ${err.message}`);
          done();
        } catch (e) { done(e); }
      }
    );
  }, true);

  addTest('验证人工改动必须填写原因', (done) => {
    reconciliationService.recordManualChange(
      recordId,
      FIELDS.SETTLEMENT_DATE,
      '2026-06-02',
      '2026-06-03',
      '',
      '阿芬',
      null,
      (err, result) => {
        try {
          assertTrue(!!err, '应该报错，原因不能为空');
          assertTrue(err.message.includes('原因'), '错误信息应包含原因');
          console.log(`   ✅ 改动原因校验工作: ${err.message}`);
          done();
        } catch (e) { done(e); }
      }
    );
  }, true);

  console.log('\n🚀 开始执行测试...\n');
  runNext();
}, 500);
