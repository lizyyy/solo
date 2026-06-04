"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const store_1 = require("../store");
const filterEngine_1 = require("../engine/filterEngine");
const counterExampleGenerator_1 = require("../engine/counterExampleGenerator");
const data_1 = require("../demo/data");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/stats', (req, res) => {
    const results = store_1.store.getFilterResults();
    const counterExamples = store_1.store.getCounterExamples();
    const totalResults = results.length;
    const normalCount = results.filter(r => r.status === 'normal').length;
    const pendingCount = results.filter(r => r.status === 'pending_review').length;
    const anomalyCount = results.filter(r => r.status === 'anomaly').length;
    const atThresholdCount = results.filter(r => r.isAtThreshold).length;
    const bothEvidenceCount = results.filter(r => r.evidenceType === 'both').length;
    const mainProcessOnlyCount = results.filter(r => r.evidenceType === 'main_process').length;
    const fieldStatementOnlyCount = results.filter(r => r.evidenceType === 'field_statement').length;
    const openCounterExamples = counterExamples.filter(c => c.status !== 'resolved').length;
    res.json({
        totalResults,
        normalCount,
        pendingCount,
        anomalyCount,
        atThresholdCount,
        bothEvidenceCount,
        mainProcessOnlyCount,
        fieldStatementOnlyCount,
        openCounterExamples,
    });
});
app.get('/api/survey-rows', (req, res) => {
    const rows = store_1.store.getSurveyRows();
    res.json(rows);
});
app.get('/api/survey-rows/:id', (req, res) => {
    const row = store_1.store.getSurveyRowById(req.params.id);
    if (!row)
        return res.status(404).json({ error: 'Not found' });
    res.json(row);
});
app.post('/api/survey-rows', (req, res) => {
    const { questionId, questionText, respondentId, respondentName, answer, answerValue, mainProcess, importedBy } = req.body;
    const row = store_1.store.addSurveyRow({
        questionId,
        questionText,
        respondentId,
        respondentName,
        answer,
        answerValue,
        mainProcess: mainProcess || '',
        timestamp: new Date().toISOString(),
        importedBy: importedBy || '小穆',
        importedAt: new Date().toISOString(),
    });
    store_1.store.addAuditLog({
        entityType: 'survey_row',
        entityId: row.id,
        action: 'import',
        actor: importedBy || '小穆',
        actorRole: 'assistant',
        changeDescription: `导入问卷原始行 - ${questionId} / ${respondentName}`,
        newValue: row,
        reason: '手动导入问卷数据',
        timestamp: new Date().toISOString(),
    });
    res.json(row);
});
app.get('/api/boundary-notes', (req, res) => {
    const notes = store_1.store.getBoundaryNotes();
    res.json(notes);
});
app.get('/api/boundary-notes/:id', (req, res) => {
    const note = store_1.store.getBoundaryNoteById(req.params.id);
    if (!note)
        return res.status(404).json({ error: 'Not found' });
    res.json(note);
});
app.post('/api/boundary-notes', (req, res) => {
    const { questionId, respondentId, fieldStatement, threshold, operator, notedBy, supplementary } = req.body;
    const note = store_1.store.addBoundaryNote({
        questionId,
        respondentId,
        fieldStatement,
        threshold,
        operator: operator || '>=',
        notedBy: notedBy || '小穆',
        notedAt: new Date().toISOString(),
        supplementary,
    });
    store_1.store.addAuditLog({
        entityType: 'boundary_note',
        entityId: note.id,
        action: 'create',
        actor: notedBy || '小穆',
        actorRole: notedBy === '小穆' ? 'assistant' : 'teacher',
        changeDescription: `补录边界值说明 - ${fieldStatement.slice(0, 30)}...`,
        newValue: note,
        reason: '补录现场观察记录',
        timestamp: new Date().toISOString(),
    });
    const regenResult = (0, counterExampleGenerator_1.regenerateCounterExamplesForNote)(note.id, notedBy || '小穆');
    res.json({
        note,
        counterExamplesUpdated: regenResult.updated.length,
        counterExamplesAdded: regenResult.added.length,
    });
});
app.get('/api/filter-results', (req, res) => {
    const status = req.query.status;
    let results;
    if (status) {
        results = store_1.store.getFilterResultsByStatus(status);
    }
    else {
        results = store_1.store.getFilterResults();
    }
    res.json(results);
});
app.get('/api/filter-results/:id', (req, res) => {
    const result = store_1.store.getFilterResultById(req.params.id);
    if (!result)
        return res.status(404).json({ error: 'Not found' });
    res.json(result);
});
app.post('/api/filter-results/:id/decide', (req, res) => {
    const { decision, decidedBy, decisionNote } = req.body;
    const result = (0, filterEngine_1.decideResult)(req.params.id, decision, decidedBy, decisionNote);
    if (!result)
        return res.status(404).json({ error: 'Not found' });
    res.json(result);
});
app.get('/api/filter-runs', (req, res) => {
    const runs = store_1.store.getFilterRuns();
    res.json(runs);
});
app.get('/api/filter-runs/:id', (req, res) => {
    const run = store_1.store.getFilterRunById(req.params.id);
    if (!run)
        return res.status(404).json({ error: 'Not found' });
    res.json(run);
});
app.post('/api/filter-run', (req, res) => {
    const { triggeredBy, configOverrides, surveyRowIds, boundaryNoteIds } = req.body;
    const result = (0, filterEngine_1.runFilter)({
        triggeredBy: triggeredBy || '小穆',
        configOverrides,
        surveyRowIds,
        boundaryNoteIds,
    });
    (0, counterExampleGenerator_1.generateCounterExamplesForRun)(result.run.id, result.results);
    res.json(result);
});
app.post('/api/filter-runs/:id/rerun', (req, res) => {
    const { triggeredBy } = req.body;
    const result = (0, filterEngine_1.reRunFilter)(req.params.id, {
        triggeredBy: triggeredBy || '小穆',
    });
    (0, counterExampleGenerator_1.generateCounterExamplesForRun)(result.run.id, result.results);
    res.json(result);
});
app.get('/api/counter-examples', (req, res) => {
    const status = req.query.status;
    const handler = req.query.handler;
    let examples;
    if (status) {
        examples = store_1.store.getCounterExamplesByStatus(status);
    }
    else if (handler) {
        examples = store_1.store.getCounterExamplesByHandler(handler);
    }
    else {
        examples = store_1.store.getCounterExamples();
    }
    res.json(examples);
});
app.get('/api/counter-examples/:id', (req, res) => {
    const example = store_1.store.getCounterExampleById(req.params.id);
    if (!example)
        return res.status(404).json({ error: 'Not found' });
    res.json(example);
});
app.post('/api/counter-examples/:id/resolve', (req, res) => {
    const { note, actor } = req.body;
    const result = (0, counterExampleGenerator_1.updateCounterExampleStatus)(req.params.id, 'resolved', actor || '小穆', note);
    if (!result)
        return res.status(404).json({ error: 'Not found' });
    res.json(result);
});
app.get('/api/audit-logs', (req, res) => {
    const logs = store_1.store.getAuditLogs();
    res.json(logs);
});
app.get('/api/audit-logs/entity/:type/:id', (req, res) => {
    const logs = store_1.store.getAuditLogsByEntity(req.params.type, req.params.id);
    res.json(logs);
});
app.get('/api/report', (req, res) => {
    const data = (0, data_1.exportDemoData)();
    const report = {
        generatedAt: new Date().toISOString(),
        title: '互信息特征筛选报告',
        summary: {
            totalSurveyRows: data.surveyRows.length,
            totalBoundaryNotes: data.boundaryNotes.length,
            totalFilterRuns: data.filterRuns.length,
            totalResults: data.results.length,
            totalCounterExamples: data.counterExamples.length,
            byStatus: {
                normal: data.results.filter(r => r.status === 'normal').length,
                pending_review: data.results.filter(r => r.status === 'pending_review').length,
                anomaly: data.results.filter(r => r.status === 'anomaly').length,
                resolved: data.results.filter(r => r.status === 'resolved').length,
            },
            atThreshold: data.results.filter(r => r.isAtThreshold).length,
            evidenceDistribution: {
                both: data.results.filter(r => r.evidenceType === 'both').length,
                main_process: data.results.filter(r => r.evidenceType === 'main_process').length,
                field_statement: data.results.filter(r => r.evidenceType === 'field_statement').length,
            },
        },
        counterExamplesReport: data.counterExamples.map(ex => ({
            id: ex.id,
            respondentName: ex.respondentName,
            questionId: ex.questionId,
            status: ex.status,
            reasonKept: ex.reasonKept,
            missingMaterials: ex.missingMaterials,
            nextAction: ex.nextAction,
            nextHandler: ex.nextHandler,
            evidence: ex.evidence,
        })),
        pendingReviewItems: data.results
            .filter(r => r.status === 'pending_review')
            .map(r => ({
            id: r.id,
            respondentName: r.respondentName,
            questionText: r.questionText,
            mutualInfoScore: r.mutualInfoScore,
            threshold: r.threshold,
            isAtThreshold: r.isAtThreshold,
            reason: r.isAtThreshold
                ? `互信息得分恰好等于阈值${r.threshold}，需任课老师人工复核`
                : `互信息得分(${r.mutualInfoScore})接近阈值(${r.threshold})，需人工确认`,
        })),
        rawData: data,
    };
    res.json(report);
});
app.post('/api/demo/init', (req, res) => {
    (0, data_1.initDemoData)();
    res.json({ message: '演示数据已初始化' });
});
app.post('/api/demo/run', (req, res) => {
    (0, data_1.initDemoData)();
    const result = (0, data_1.runDemoWorkflow)();
    (0, data_1.printDemoSummary)();
    res.json(result);
});
app.post('/api/reset', (req, res) => {
    store_1.store.reset();
    res.json({ message: '数据已重置' });
});
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n🚀 互信息特征筛选系统 API 服务器已启动`);
        console.log(`📡 API 地址: http://localhost:${PORT}`);
        console.log(`🌐 Web 面板: http://localhost:3000 (需要启动前端服务)`);
        console.log(`\n📖 快速开始:`);
        console.log(`   1. 运行演示: npm run demo`);
        console.log(`   2. 启动API: npm start`);
        console.log(`   3. 启动Web: npm run start:web`);
        console.log(`\n🎯 核心功能:`);
        console.log(`   - 问卷原始行导入`);
        console.log(`   - 边界值说明补录`);
        console.log(`   - 互信息特征筛选`);
        console.log(`   - 反例列表自动生成（原因/缺材料/下一步找谁）`);
        console.log(`   - 边界值等于阈值时自动标记待任课老师复核`);
        console.log(`   - 完整审计追踪`);
        console.log();
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map