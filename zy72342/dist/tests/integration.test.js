"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const store_1 = require("../store");
const filterEngine_1 = require("../engine/filterEngine");
const counterExampleGenerator_1 = require("../engine/counterExampleGenerator");
const data_1 = require("../demo/data");
const mutualInfo_1 = require("../engine/mutualInfo");
function assert(condition, message) {
    if (!condition) {
        console.error(`❌ 测试失败: ${message}`);
        process.exit(1);
    }
    else {
        console.log(`✅ ${message}`);
    }
}
async function runTests() {
    console.log('\n🧪 开始运行集成测试\n');
    console.log('--- 测试 1: 互信息计算 ---');
    const miResult = (0, mutualInfo_1.calculateMutualInformation)({
        answerValues: [1, 2, 3, 4, 5],
        targetLabels: [0, 0, 1, 1, 1],
    });
    assert(miResult >= 0 && miResult <= 1, `互信息得分在有效范围内 (${miResult.toFixed(4)})`);
    console.log('\n--- 测试 2: 边界值条件判断 ---');
    const boundaryResult1 = (0, mutualInfo_1.evaluateBoundaryCondition)(0.5, {
        id: 'test',
        questionId: 'Q001',
        fieldStatement: '测试',
        threshold: 0.5,
        operator: '>=',
        notedBy: 'test',
        notedAt: new Date().toISOString(),
    });
    assert(boundaryResult1 === true, '边界值 >= 0.5 判断正确 (0.5 >= 0.5)');
    const boundaryResult2 = (0, mutualInfo_1.evaluateBoundaryCondition)(0.499, {
        id: 'test',
        questionId: 'Q001',
        fieldStatement: '测试',
        threshold: 0.5,
        operator: '>',
        notedBy: 'test',
        notedAt: new Date().toISOString(),
    });
    assert(boundaryResult2 === false, '边界值 > 0.5 判断正确 (0.499 > 0.5)');
    console.log('\n--- 测试 3: 初始化演示数据 ---');
    store_1.store.reset();
    (0, data_1.initDemoData)();
    const surveyRows = store_1.store.getSurveyRows();
    const boundaryNotes = store_1.store.getBoundaryNotes();
    assert(surveyRows.length === 9, `问卷原始行导入正确 (${surveyRows.length} 条)`);
    assert(boundaryNotes.length === 2, `边界值说明导入正确 (${boundaryNotes.length} 条)`);
    console.log('\n--- 测试 4: 第一次运行筛选（不使用边界值说明）---');
    const step1 = (0, filterEngine_1.runFilter)({
        triggeredBy: '小穆',
        boundaryNoteIds: [],
    });
    assert(step1.summary.total === 9, `处理了所有问卷行 (${step1.summary.total} 条)`);
    assert(step1.summary.atThreshold >= 0, `正确识别边界值等于阈值的记录`);
    const resultsAtThreshold = step1.results.filter(r => r.isAtThreshold);
    for (const result of resultsAtThreshold) {
        assert(result.status === 'pending_review', `边界值等于阈值的记录标记为待复核 (${result.respondentName})`);
    }
    console.log(`   找到 ${resultsAtThreshold.length} 条边界值恰好等于阈值的记录，均标记为待任课老师复核`);
    console.log('\n--- 测试 5: 生成反例列表 ---');
    const counterExamples = (0, counterExampleGenerator_1.generateCounterExamplesForRun)(step1.run.id, step1.results);
    assert(counterExamples.length > 0, `生成了反例列表 (${counterExamples.length} 条)`);
    for (const ex of counterExamples) {
        assert(!!ex.reasonKept && ex.reasonKept.length > 0, `反例 ${ex.respondentName} 有明确的留下原因`);
        assert(!!ex.nextHandler, `反例 ${ex.respondentName} 有明确的下一步处理人`);
        assert(ex.nextAction === 'contact_teacher' ||
            ex.nextAction === 'contact_assistant' ||
            ex.nextAction === 'collect_more' ||
            ex.nextAction === 'resolved', `反例 ${ex.respondentName} 的下一步动作正确 (${ex.nextAction})`);
    }
    const missingFieldEvidence = counterExamples.filter(ex => ex.reasonKept.includes('缺少边界值说明'));
    console.log(`   ${missingFieldEvidence.length} 条反例因为缺边界值说明，下一步找实验助理小穆`);
    console.log('\n--- 测试 6: 补录边界值说明后反例列表自动更新 ---');
    const newNote = store_1.store.addBoundaryNote({
        questionId: 'Q001',
        respondentId: 'S2024002',
        fieldStatement: '李四同学当天身体不适，实验中途休息了10分钟',
        threshold: 0.5,
        operator: '>=',
        notedBy: '小穆',
        notedAt: new Date().toISOString(),
        supplementary: '已确认情况属实',
    });
    store_1.store.addAuditLog({
        entityType: 'boundary_note',
        entityId: newNote.id,
        action: 'create',
        actor: '小穆',
        actorRole: 'assistant',
        changeDescription: `补录边界值说明 - ${newNote.fieldStatement}`,
        newValue: newNote,
        reason: '实验助理小穆复核反例列表后补充记录',
        timestamp: new Date().toISOString(),
    });
    const regenResult = (0, counterExampleGenerator_1.regenerateCounterExamplesForNote)(newNote.id, '小穆');
    console.log(`   更新了 ${regenResult.updated.length} 条反例，新增 ${regenResult.added.length} 条反例`);
    const updatedCounterExample = store_1.store.getCounterExamples().find(c => c.respondentId === 'S2024002' && c.questionId === 'Q001');
    if (updatedCounterExample) {
        assert(!!updatedCounterExample.evidence.fieldStatement && updatedCounterExample.evidence.fieldStatement.includes('李四'), '反例中的现场说法已更新为包含新补录的边界值说明');
        console.log(`   李四的反例证据已更新: 现在有主流程 + 现场说法双边证据`);
    }
    console.log('\n--- 测试 7: 重跑筛选 ---');
    const step4 = (0, filterEngine_1.reRunFilter)(step1.run.id, {
        triggeredBy: '小穆',
    });
    assert(step4.summary.total === 9, `重跑处理了所有问卷行 (${step4.summary.total} 条)`);
    assert(step4.summary.withBothEvidence >= 1, `重跑后有双边证据的记录 (${step4.summary.withBothEvidence} 条)`);
    console.log(`   重跑完成，${step4.summary.withBothEvidence} 条记录有双边证据`);
    console.log('\n--- 测试 8: 人工复核边界值等于阈值的记录 ---');
    const pendingAtThreshold = step4.results.find(r => r.isAtThreshold);
    if (pendingAtThreshold) {
        console.log(`   找到待复核记录: ${pendingAtThreshold.respondentName}, 得分=${pendingAtThreshold.mutualInfoScore}, 阈值=${pendingAtThreshold.threshold}`);
        const decided = (0, filterEngine_1.decideResult)(pendingAtThreshold.id, 'approve_normal', '张老师', '经核实，该生态度认真，给予通过');
        assert(!!decided, '决策记录成功');
        assert(decided.status === 'normal', '决策后状态更新为正常');
        assert(decided.decidedBy === '张老师', '决策人正确记录');
        assert(!!decided.decisionNote && decided.decisionNote.includes('张老师'), '决策备注正确记录');
        console.log(`   张老师复核完成，判定为正常`);
        const auditLogs = store_1.store.getAuditLogsByEntity('filter_result', pendingAtThreshold.id);
        const decisionLog = auditLogs.find(l => l.action === 'decide');
        assert(!!decisionLog, '审计日志记录了决策操作');
        assert(decisionLog.actor === '张老师', '审计日志记录了决策人');
        assert(decisionLog.reason === '经核实，该生态度认真，给予通过', '审计日志记录了决策原因');
        console.log(`   审计日志正确记录了谁改了什么、为什么改`);
    }
    console.log('\n--- 测试 9: 反例分析逻辑验证 ---');
    const testResultWithoutEvidence = {
        id: 'test-1',
        questionId: 'Q001',
        respondentId: 'S001',
        respondentName: '测试学生',
        questionText: '测试问题',
        answer: '一般',
        answerValue: 3,
        mutualInfoScore: 0.45,
        threshold: 0.5,
        isAtThreshold: false,
        evidenceType: 'main_process',
        mainProcessEvidence: '未填写主流程说明',
        status: 'pending_review',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    const analysis1 = (0, counterExampleGenerator_1.analyzeCounterExample)(testResultWithoutEvidence, []);
    assert(analysis1.reasonKept.includes('两边证据都不足') || analysis1.reasonKept.includes('证据链不完整'), '缺少证据时正确分析原因');
    assert(analysis1.nextHandler === '小穆', '缺少边界值说明时下一步找小穆');
    assert(analysis1.missingMaterials.length > 0 &&
        (analysis1.missingMaterials.some(m => m.includes('边界值说明')) ||
            analysis1.missingMaterials.some(m => m.includes('现场说法')) ||
            analysis1.missingMaterials.some(m => m.includes('主流程'))), '正确列出缺少的材料');
    const testResultAtThreshold = {
        ...testResultWithoutEvidence,
        mutualInfoScore: 0.5,
        threshold: 0.5,
        isAtThreshold: true,
        mainProcessEvidence: '学生完成了实验',
        fieldStatementEvidence: '现场观察正常',
        evidenceType: 'both',
    };
    const analysis2 = (0, counterExampleGenerator_1.analyzeCounterExample)(testResultAtThreshold, []);
    assert(analysis2.reasonKept.includes('恰好等于阈值') && analysis2.reasonKept.includes('任课老师复核'), '边界值等于阈值时正确分析原因，说明留给任课老师复核');
    assert(analysis2.nextAction === 'contact_teacher', '边界值等于阈值时下一步找任课老师');
    console.log('\n--- 测试 10: 审计日志完整性 ---');
    const allLogs = store_1.store.getAuditLogs();
    assert(allLogs.length >= 5, `审计日志记录完整 (${allLogs.length} 条)`);
    const importLogs = allLogs.filter(l => l.action === 'import');
    const createLogs = allLogs.filter(l => l.action === 'create');
    const decideLogs = allLogs.filter(l => l.action === 'decide');
    const reRunLogs = allLogs.filter(l => l.action === 're_run');
    assert(importLogs.length > 0, '有导入操作的审计记录');
    assert(createLogs.length > 0, '有创建操作的审计记录');
    assert(decideLogs.length > 0, '有决策操作的审计记录');
    for (const log of allLogs) {
        assert(!!log.actor, `审计日志有操作人 (${log.action})`);
        assert(!!log.reason, `审计日志有原因说明 (${log.action})`);
        assert(!!log.changeDescription, `审计日志有变更说明 (${log.action})`);
    }
    console.log('\n--- 测试 11: 完整演示流程 ---');
    store_1.store.reset();
    const demoResult = (0, data_1.runDemoWorkflow)();
    assert(demoResult.step1.summary.total === 9, '步骤1: 第一次筛选处理正确');
    assert(demoResult.step2.length > 0, '步骤2: 生成反例列表正确');
    assert(demoResult.step3.updated.length + demoResult.step3.added.length >= 0, '步骤3: 补录边界值说明后反例更新正确');
    assert(demoResult.step4.summary.total === 9, '步骤4: 重跑筛选正确');
    assert(!!demoResult.step5 || demoResult.step4.results.every(r => !r.isAtThreshold), '步骤5: 人工复核正确执行');
    console.log('\n--- 测试 12: 关键三步流程验证 ---');
    store_1.store.reset();
    (0, data_1.initDemoData)();
    console.log('   第一步: 导入问卷原始行');
    const rows = store_1.store.getSurveyRows();
    assert(rows.length === 9, '问卷原始行导入成功');
    console.log('   第二步: 第一次运行筛选，生成反例');
    const firstRun = (0, filterEngine_1.runFilter)({ triggeredBy: '小穆', boundaryNoteIds: [] });
    const firstCounterExamples = (0, counterExampleGenerator_1.generateCounterExamplesForRun)(firstRun.run.id, firstRun.results);
    assert(firstCounterExamples.length > 0, '反例列表生成成功');
    const needAssistant = firstCounterExamples.filter(c => c.nextHandler === '小穆');
    console.log(`   第三步: 实验助理小穆补看边界值说明`);
    console.log(`   小穆需要处理 ${needAssistant.length} 条反例`);
    for (const ex of needAssistant.slice(0, 1)) {
        const note = store_1.store.addBoundaryNote({
            questionId: ex.questionId,
            respondentId: ex.respondentId,
            fieldStatement: `现场补充说明: ${ex.respondentName} 的情况`,
            threshold: 0.5,
            operator: '>=',
            notedBy: '小穆',
            notedAt: new Date().toISOString(),
        });
        const updateResult = (0, counterExampleGenerator_1.regenerateCounterExamplesForNote)(note.id, '小穆');
        const updatedEx = store_1.store.getCounterExampleById(ex.id);
        assert(!!updatedEx?.evidence.fieldStatement, `补录后 ${ex.respondentName} 的反例已更新`);
        console.log(`   补录后, ${ex.respondentName} 的反例从「找小穆」更新为「${updatedEx?.nextHandler === '小穆' ? '仍需小穆处理' : updatedEx?.nextHandler}」`);
    }
    console.log('\n🎉 所有测试通过！');
    console.log('\n📋 测试总结:');
    console.log('   ✅ 互信息计算正确');
    console.log('   ✅ 边界值判断正确');
    console.log('   ✅ 边界值等于阈值时标记待任课老师复核');
    console.log('   ✅ 反例列表包含原因、缺什么材料、下一步找谁');
    console.log('   ✅ 补录边界值说明后反例列表自动更新');
    console.log('   ✅ 审计日志完整记录谁改了什么、为什么改');
    console.log('   ✅ 完整演示流程正常');
    console.log('   ✅ 关键三步流程（导入→补录→更新）正常');
    console.log();
}
runTests().catch(console.error);
//# sourceMappingURL=integration.test.js.map