"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const DATA_FILE = path_1.default.join(__dirname, '../data/reconciliation.json');
function loadData() {
    const dir = path_1.default.dirname(DATA_FILE);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    if (fs_1.default.existsSync(DATA_FILE)) {
        return JSON.parse(fs_1.default.readFileSync(DATA_FILE, 'utf-8'));
    }
    const initial = {
        records: [],
        adjustments: [],
        auditLogs: [],
        reviews: [],
        holidays: [
            { date: '2024-05-01', name: '劳动节', type: 'public_holiday' },
            { date: '2024-05-02', name: '劳动节', type: 'public_holiday' },
            { date: '2024-05-03', name: '劳动节', type: 'public_holiday' },
            { date: '2024-06-10', name: '端午节', type: 'public_holiday' },
            { date: '2024-09-17', name: '中秋节', type: 'public_holiday' },
            { date: '2024-10-01', name: '国庆节', type: 'public_holiday' },
            { date: '2024-10-02', name: '国庆节', type: 'public_holiday' },
            { date: '2024-10-03', name: '国庆节', type: 'public_holiday' },
            { date: '2024-10-04', name: '国庆节', type: 'public_holiday' },
            { date: '2024-10-07', name: '国庆节', type: 'public_holiday' },
        ]
    };
    saveData(initial);
    return initial;
}
function saveData(data) {
    const dir = path_1.default.dirname(DATA_FILE);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    fs_1.default.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
let db = loadData();
const uuid_1 = require("uuid");
const date_fns_1 = require("date-fns");
function calculateExpectedArrivalDate(tradeDate) {
    const date = (0, date_fns_1.parseISO)(tradeDate);
    let expected = (0, date_fns_1.addDays)(date, 1);
    let attempts = 0;
    while ((db.holidays.some((h) => h.date === (0, date_fns_1.format)(expected, 'yyyy-MM-dd')) ||
        [0, 6].includes(expected.getDay())) &&
        attempts < 10) {
        expected = (0, date_fns_1.addDays)(expected, 1);
        attempts++;
    }
    return (0, date_fns_1.format)(expected, 'yyyy-MM-dd');
}
function isWeekend(dateStr) {
    const date = (0, date_fns_1.parseISO)(dateStr);
    return date.getDay() === 0 || date.getDay() === 6;
}
function getHolidayExplanation(startDate, endDate) {
    const holidays = db.holidays.filter((h) => h.date >= startDate && h.date <= endDate);
    if (holidays.length === 0)
        return '';
    return `节假日顺延：${holidays.map((h) => `${h.date} ${h.name}`).join('、')}`;
}
function generateReconciliationNote(record, hasAdjustments) {
    const parts = [];
    const missingMaterials = [];
    const nextActions = [];
    const delayDays = (0, date_fns_1.differenceInDays)((0, date_fns_1.parseISO)(record.actualArrivalDate), (0, date_fns_1.parseISO)(record.expectedArrivalDate));
    const holidayExp = getHolidayExplanation(record.expectedArrivalDate, record.actualArrivalDate);
    if (record.hasManualModification) {
        if (record.modificationType === 't1_to_t2') {
            parts.push(`T+1到账（${record.expectedArrivalDate}）被手工修改为T+2（${record.actualArrivalDate}），延迟${delayDays}天`);
            if (holidayExp)
                parts.push(holidayExp);
            if (record.modificationReason)
                parts.push(`修改原因：${record.modificationReason}`);
            if (record.modifiedBy)
                parts.push(`修改人：${record.modifiedBy}`);
            missingMaterials.push('银行交割凭证', '支付平台流水单', '修改授权确认书');
            nextActions.push('请基金经理复核T+1→T+2修改原因，不急着归正常');
            nextActions.push('确认后联系支付平台产品阿南');
        }
        else {
            parts.push(`存在人工修改记录，${record.modificationReason || '原因待查'}`);
            if (record.modifiedBy)
                parts.push(`修改人：${record.modifiedBy}`);
            nextActions.push('请联系支付平台产品阿南核实修改原因');
        }
    }
    else if (delayDays > 0) {
        parts.push(`到账延迟${delayDays}天`);
        if (holidayExp) {
            parts.push(holidayExp);
            parts.push('延迟属于正常节假日顺延');
            nextActions.push('无需处理，自动标记为正常');
        }
        else {
            parts.push('延迟原因待查');
            missingMaterials.push('到账延迟说明');
            nextActions.push('请联系支付平台产品阿南核实延迟原因');
        }
    }
    else {
        parts.push('正常到账，无需特殊处理');
        nextActions.push('无需处理');
    }
    if (hasAdjustments)
        parts.push('已补录尾差调整条');
    return {
        whyKept: parts.join('；'),
        missingMaterials: missingMaterials.join('、'),
        nextAction: nextActions.join('；')
    };
}
function addAuditLog(data) {
    const log = {
        id: (0, uuid_1.v4)(),
        ...data,
        timestamp: (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss')
    };
    db.auditLogs.unshift(log);
    saveData(db);
    return log;
}
// Routes
app.get('/api/records', (req, res) => {
    const { fundCode, onlyModifications } = req.query;
    let records = db.records;
    if (onlyModifications === 'true')
        records = records.filter((r) => r.hasManualModification);
    if (fundCode)
        records = records.filter((r) => r.fundCode === fundCode);
    res.json({ success: true, data: records });
});
app.get('/api/records/:id', (req, res) => {
    const record = db.records.find((r) => r.id === req.params.id);
    if (!record)
        return res.status(404).json({ success: false, message: '记录不存在' });
    const adjustments = db.adjustments.filter((a) => a.recordId === record.id);
    const auditLogs = db.auditLogs.filter((l) => l.recordId === record.id);
    const reviews = db.reviews.filter((r) => r.recordId === record.id);
    res.json({ success: true, data: { ...record, adjustments, auditLogs, reviews } });
});
app.post('/api/records/import', (req, res) => {
    const { records, operator } = req.body;
    if (!records || !Array.isArray(records))
        return res.status(400).json({ success: false, message: '请提供有效的记录数据' });
    const op = operator || '支付平台阿南';
    const now = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const results = [];
    let modCount = 0;
    records.forEach((r) => {
        const expectedDate = r.expectedArrivalDate || calculateExpectedArrivalDate(r.tradeDate);
        const hasManualModification = expectedDate !== r.actualArrivalDate;
        const isT1ToT2 = hasManualModification && (0, date_fns_1.differenceInDays)((0, date_fns_1.parseISO)(r.actualArrivalDate), (0, date_fns_1.parseISO)(expectedDate)) >= 1;
        const note = generateReconciliationNote({
            ...r, expectedArrivalDate: expectedDate, hasManualModification,
            modificationType: isT1ToT2 ? 't1_to_t2' : undefined,
            modifiedBy: hasManualModification ? op : undefined,
            modificationReason: hasManualModification ? '导入时检测到人工修改' : undefined
        }, false);
        const record = {
            id: (0, uuid_1.v4)(), tradeDate: r.tradeDate, expectedArrivalDate: expectedDate,
            actualArrivalDate: r.actualArrivalDate, amount: r.amount,
            fundCode: r.fundCode, futuresCode: r.futuresCode,
            status: hasManualModification ? 'reviewing' : 'pending',
            hasManualModification, modificationType: isT1ToT2 ? 't1_to_t2' : null,
            modifiedBy: hasManualModification ? op : null, modifiedAt: hasManualModification ? now : null,
            modificationReason: hasManualModification ? '导入时检测到人工修改' : null,
            whyKept: note.whyKept, missingMaterials: note.missingMaterials, nextAction: note.nextAction,
            lastUpdatedBy: '系统', lastUpdatedAt: now, createdAt: now, updatedAt: now
        };
        db.records.unshift(record);
        if (hasManualModification)
            modCount++;
        addAuditLog({ recordId: record.id, action: 'import', reason: '导入交割数据', operator: op, operatorRole: 'product_manager', affectedResults: '预期到账日、金额、基金代码、对账说明已生成' });
        if (hasManualModification) {
            addAuditLog({ recordId: record.id, action: 'modify', fieldName: 'actual_arrival_date', oldValue: expectedDate, newValue: r.actualArrivalDate, reason: '导入时检测到人工修改到账日', operator: op, operatorRole: 'product_manager', affectedResults: '对账状态变为reviewing，触发基金经理复核' });
        }
        results.push(record);
    });
    saveData(db);
    res.json({ success: true, data: { imported: results.length, hasManualModifications: modCount, records: results }, message: `成功导入${results.length}条记录，其中${modCount}条包含人工修改` });
});
app.put('/api/records/:id/reconciliation', (req, res) => {
    const record = db.records.find((r) => r.id === req.params.id);
    if (!record)
        return res.status(404).json({ success: false, message: '记录不存在' });
    const note = req.body;
    const oldWhyKept = record.whyKept;
    const now = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss');
    Object.assign(record, { whyKept: note.whyKept, missingMaterials: note.missingMaterials, nextAction: note.nextAction, lastUpdatedBy: note.updatedBy, lastUpdatedAt: now, updatedAt: now });
    addAuditLog({ recordId: record.id, action: 'modify', fieldName: 'reconciliation_note', oldValue: oldWhyKept, newValue: note.whyKept, reason: '人工更新对账说明', operator: note.updatedBy, operatorRole: 'product_manager', affectedResults: '对账说明已更新，等待基金经理复核' });
    saveData(db);
    const adjustments = db.adjustments.filter((a) => a.recordId === record.id);
    const auditLogs = db.auditLogs.filter((l) => l.recordId === record.id);
    const reviews = db.reviews.filter((r) => r.recordId === record.id);
    res.json({ success: true, data: { ...record, adjustments, auditLogs, reviews }, message: '对账说明已更新' });
});
app.put('/api/records/:id/mark-modification', (req, res) => {
    const record = db.records.find((r) => r.id === req.params.id);
    if (!record)
        return res.status(404).json({ success: false, message: '记录不存在' });
    const { actualArrivalDate, modifiedBy, modificationReason } = req.body;
    const oldDate = record.actualArrivalDate;
    const now = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss');
    Object.assign(record, { actualArrivalDate, hasManualModification: true, modificationType: 't1_to_t2', modifiedBy, modifiedAt: now, modificationReason, status: 'reviewing', updatedAt: now });
    const adjustments = db.adjustments.filter((a) => a.recordId === record.id);
    const note = generateReconciliationNote(record, adjustments.length > 0);
    Object.assign(record, { whyKept: note.whyKept, missingMaterials: note.missingMaterials, nextAction: note.nextAction, lastUpdatedBy: modifiedBy, lastUpdatedAt: now });
    addAuditLog({ recordId: record.id, action: 'modify', fieldName: 'actual_arrival_date', oldValue: oldDate, newValue: actualArrivalDate, reason: modificationReason, operator: modifiedBy, operatorRole: 'product_manager', affectedResults: '对账状态变为reviewing，触发基金经理复核，T+1→T+2修改标记，留待基金经理复核' });
    saveData(db);
    const auditLogs = db.auditLogs.filter((l) => l.recordId === record.id);
    const reviews = db.reviews.filter((r) => r.recordId === record.id);
    res.json({ success: true, data: { ...record, adjustments, auditLogs, reviews }, message: '已标记为T+1→T+2人工修改' });
});
app.post('/api/records/:id/review', (req, res) => {
    const record = db.records.find((r) => r.id === req.params.id);
    if (!record)
        return res.status(404).json({ success: false, message: '记录不存在' });
    const { reviewer, status: rawStatus, decision, comment } = req.body;
    const status = rawStatus || decision;
    if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: '请提供有效的复核决定(approved/rejected)' });
    }
    const now = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const review = { id: (0, uuid_1.v4)(), recordId: record.id, reviewer, status, comment: comment || null, reviewedAt: now };
    db.reviews.unshift(review);
    record.status = status;
    record.updatedAt = now;
    addAuditLog({ recordId: record.id, action: 'review', reason: comment || '基金经理复核', operator: reviewer, operatorRole: 'fund_manager', affectedResults: `记录已${status === 'approved' ? '通过' : '驳回'}` });
    if (status === 'approved') {
        const adjustments = db.adjustments.filter((a) => a.recordId === record.id);
        const note = generateReconciliationNote(record, adjustments.length > 0);
        Object.assign(record, { whyKept: note.whyKept, missingMaterials: note.missingMaterials, nextAction: note.nextAction, lastUpdatedBy: '系统', lastUpdatedAt: now });
    }
    saveData(db);
    const adjustments = db.adjustments.filter((a) => a.recordId === record.id);
    const auditLogs = db.auditLogs.filter((l) => l.recordId === record.id);
    const reviews = db.reviews.filter((r) => r.recordId === record.id);
    res.json({ success: true, data: { review, record: { ...record, adjustments, auditLogs, reviews } }, message: `记录已${status === 'approved' ? '通过' : '驳回'}` });
});
app.post('/api/records/:id/rerun', (req, res) => {
    const record = db.records.find((r) => r.id === req.params.id);
    if (!record)
        return res.status(404).json({ success: false, message: '记录不存在' });
    const { operator } = req.body;
    const now = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const newExpected = calculateExpectedArrivalDate(record.tradeDate);
    const hasMod = newExpected !== record.actualArrivalDate;
    const adjustments = db.adjustments.filter((a) => a.recordId === record.id);
    const note = generateReconciliationNote({ ...record, expectedArrivalDate: newExpected, hasManualModification: hasMod, modificationType: hasMod ? 't1_to_t2' : undefined }, adjustments.length > 0);
    const oldWhyKept = record.whyKept;
    Object.assign(record, { expectedArrivalDate: newExpected, hasManualModification: hasMod, modificationType: hasMod ? 't1_to_t2' : null, whyKept: note.whyKept, missingMaterials: note.missingMaterials, nextAction: note.nextAction, lastUpdatedBy: operator || '系统', lastUpdatedAt: now, updatedAt: now });
    addAuditLog({ recordId: record.id, action: 'rerun', fieldName: 'reconciliation', oldValue: oldWhyKept, newValue: note.whyKept, reason: '重跑对账逻辑', operator: operator || '系统', operatorRole: 'product_manager', affectedResults: '对账说明已重新生成' });
    saveData(db);
    const auditLogs = db.auditLogs.filter((l) => l.recordId === record.id);
    const reviews = db.reviews.filter((r) => r.recordId === record.id);
    res.json({ success: true, data: { ...record, adjustments, auditLogs, reviews }, message: '对账逻辑已重跑' });
});
app.get('/api/records/:id/reviews', (req, res) => {
    const reviews = db.reviews.filter((r) => r.recordId === req.params.id);
    res.json({ success: true, data: reviews });
});
app.get('/api/adjustments', (req, res) => {
    res.json({ success: true, data: db.adjustments });
});
app.get('/api/adjustments/record/:recordId', (req, res) => {
    const adjustments = db.adjustments.filter((a) => a.recordId === req.params.recordId);
    res.json({ success: true, data: adjustments });
});
app.post('/api/adjustments', (req, res) => {
    const data = req.body;
    const record = db.records.find((r) => r.id === data.recordId);
    if (!record)
        return res.status(400).json({ success: false, message: '记录不存在' });
    const now = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const adjustment = { id: (0, uuid_1.v4)(), recordId: data.recordId, amount: data.amount, reason: data.reason, adjustedBy: data.adjustedBy, adjustedAt: now, affectsReconciliation: true };
    db.adjustments.unshift(adjustment);
    addAuditLog({ recordId: data.recordId, action: 'adjust', reason: data.reason, operator: data.adjustedBy, operatorRole: 'product_manager', affectedResults: '对账说明自动更新，增加尾差调整说明' });
    const allAdjustments = db.adjustments.filter((a) => a.recordId === data.recordId);
    const note = generateReconciliationNote(record, allAdjustments.length > 0);
    Object.assign(record, { whyKept: note.whyKept, missingMaterials: note.missingMaterials, nextAction: note.nextAction, lastUpdatedBy: '系统', lastUpdatedAt: now, updatedAt: now });
    addAuditLog({ recordId: data.recordId, action: 'modify', fieldName: 'reconciliation_note', oldValue: record.whyKept, newValue: note.whyKept, reason: '自动更新对账说明（尾差调整触发）', operator: '系统', operatorRole: 'system', affectedResults: '对账说明同步更新' });
    saveData(db);
    res.json({ success: true, data: adjustment, message: '尾差调整已创建，关联记录的对账说明已自动更新' });
});
app.get('/api/adjustments/:id/impact', (req, res) => {
    const adj = db.adjustments.find((a) => a.id === req.params.id);
    if (!adj)
        return res.status(404).json({ success: false, message: '尾差调整不存在' });
    const record = db.records.find((r) => r.id === adj.recordId);
    res.json({ success: true, data: { ...adj, recordSummary: record ? { id: record.id, fundCode: record.fundCode, futuresCode: record.futuresCode, amount: record.amount, status: record.status } : null, impactAnalysis: record ? { originalAmount: record.amount, adjustedAmount: record.amount + adj.amount, reconciliationNoteUpdated: adj.affectsReconciliation } : null } });
});
app.post('/api/adjustments/recalculate', (req, res) => {
    const affectedIds = new Set(db.adjustments.map((a) => a.recordId));
    const results = [];
    affectedIds.forEach(recordId => {
        const record = db.records.find((r) => r.id === recordId);
        if (record) {
            const adjustments = db.adjustments.filter((a) => a.recordId === recordId);
            const note = generateReconciliationNote(record, adjustments.length > 0);
            const now = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss');
            Object.assign(record, { whyKept: note.whyKept, missingMaterials: note.missingMaterials, nextAction: note.nextAction, lastUpdatedBy: '系统', lastUpdatedAt: now });
            results.push({ recordId, updated: true });
        }
    });
    saveData(db);
    res.json({ success: true, data: results, message: `已重新计算${results.length}条受影响记录的对账说明` });
});
app.get('/api/audit', (req, res) => {
    res.json({ success: true, data: db.auditLogs.slice(0, 100) });
});
app.get('/api/audit/record/:recordId', (req, res) => {
    const logs = db.auditLogs.filter((l) => l.recordId === req.params.recordId);
    res.json({ success: true, data: logs, summary: { totalChanges: logs.length, modifyCount: logs.filter((l) => l.action === 'modify').length, adjustCount: logs.filter((l) => l.action === 'adjust').length, reviewCount: logs.filter((l) => l.action === 'review').length } });
});
app.get('/api/demo/init', (req, res) => {
    const { step } = req.query;
    const now = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss');
    if (step === '1' || !step) {
        const tradeDate = '2024-04-30';
        const expectedDate = calculateExpectedArrivalDate(tradeDate);
        const actualDate = '2024-05-07';
        const delayDays1 = (0, date_fns_1.differenceInDays)((0, date_fns_1.parseISO)(actualDate), (0, date_fns_1.parseISO)(expectedDate));
        const holidayExp1 = getHolidayExplanation(expectedDate, actualDate);
        const r1Base = {
            id: 'demo-001', tradeDate, expectedArrivalDate: expectedDate, actualArrivalDate: actualDate,
            amount: 1500000, fundCode: 'FUND-001', futuresCode: 'IF2405',
            hasManualModification: true, modificationType: 't1_to_t2',
            modifiedBy: '张三', modifiedAt: '2024-05-05 14:30:00',
            modificationReason: '节假日顺延后再延迟1天到账'
        };
        const note1 = generateReconciliationNote(r1Base, false);
        const r1 = {
            ...r1Base, status: 'reviewing',
            whyKept: note1.whyKept, missingMaterials: note1.missingMaterials, nextAction: note1.nextAction,
            lastUpdatedBy: '支付平台阿南', lastUpdatedAt: '2024-05-05 15:00:00', createdAt: now, updatedAt: now
        };
        const tradeDate2 = '2024-06-08';
        const expectedDate2 = calculateExpectedArrivalDate(tradeDate2);
        const r2Base = {
            id: 'demo-002', tradeDate: tradeDate2, expectedArrivalDate: expectedDate2, actualArrivalDate: expectedDate2,
            amount: 850000, fundCode: 'FUND-002', futuresCode: 'IC2406',
            hasManualModification: false, modificationType: null, modifiedBy: null, modifiedAt: null, modificationReason: null
        };
        const note2 = generateReconciliationNote(r2Base, false);
        const r2 = {
            ...r2Base, status: 'pending',
            whyKept: note2.whyKept, missingMaterials: note2.missingMaterials, nextAction: note2.nextAction,
            lastUpdatedBy: '系统', lastUpdatedAt: now, createdAt: now, updatedAt: now
        };
        if (!db.records.find((r) => r.id === 'demo-001')) {
            db.records.unshift(r1, r2);
            addAuditLog({ recordId: r1.id, action: 'import', reason: '导入交割数据（演示Step1）', operator: '系统', operatorRole: 'system', affectedResults: '预期到账日、金额、基金代码、对账说明已生成' });
            addAuditLog({ recordId: r1.id, action: 'modify', fieldName: 'actual_arrival_date', oldValue: expectedDate, newValue: actualDate, reason: '手工调整到账日（演示）', operator: '张三', operatorRole: 'product_manager', affectedResults: `预期${expectedDate}→实际${actualDate}，延迟${delayDays1}天，对账状态变为reviewing，触发基金经理复核` });
            addAuditLog({ recordId: r2.id, action: 'import', reason: '导入交割数据（演示Step1）', operator: '系统', operatorRole: 'system', affectedResults: '预期到账日、金额、基金代码、对账说明已生成' });
        }
        saveData(db);
    }
    if (step === '2' || !step) {
        const tradeDate3 = '2024-09-16';
        const expectedDate3 = calculateExpectedArrivalDate(tradeDate3);
        const actualDate3 = '2024-09-19';
        const delayDays3 = (0, date_fns_1.differenceInDays)((0, date_fns_1.parseISO)(actualDate3), (0, date_fns_1.parseISO)(expectedDate3));
        const r3Base = {
            id: 'demo-003', tradeDate: tradeDate3, expectedArrivalDate: expectedDate3, actualArrivalDate: actualDate3,
            amount: 2200000, fundCode: 'FUND-001', futuresCode: 'IF2409',
            hasManualModification: true, modificationType: 't1_to_t2',
            modifiedBy: '李四', modifiedAt: '2024-09-18 16:45:00',
            modificationReason: '中秋节假日影响'
        };
        const note3 = generateReconciliationNote(r3Base, false);
        const r3 = {
            ...r3Base, status: 'reviewing',
            whyKept: note3.whyKept, missingMaterials: note3.missingMaterials, nextAction: note3.nextAction,
            lastUpdatedBy: '支付平台阿南', lastUpdatedAt: now, createdAt: now, updatedAt: now
        };
        if (!db.records.find((r) => r.id === 'demo-003')) {
            db.records.unshift(r3);
            addAuditLog({ recordId: r3.id, action: 'import', reason: '导入交割数据（演示Step2）', operator: '系统', operatorRole: 'system', affectedResults: '预期到账日、金额、基金代码、对账说明已生成' });
            addAuditLog({ recordId: r3.id, action: 'modify', fieldName: 'actual_arrival_date', oldValue: expectedDate3, newValue: actualDate3, reason: '手工调整到账日（演示）', operator: '李四', operatorRole: 'product_manager', affectedResults: `预期${expectedDate3}→实际${actualDate3}，延迟${delayDays3}天，对账状态变为reviewing` });
        }
        if (!db.adjustments.find((a) => a.recordId === 'demo-003')) {
            const adj = { id: (0, uuid_1.v4)(), recordId: r3.id, amount: 125.50, reason: '银行手续费尾差调整', adjustedBy: '支付平台阿南', adjustedAt: now, affectsReconciliation: true };
            db.adjustments.unshift(adj);
            addAuditLog({ recordId: r3.id, action: 'adjust', reason: '银行手续费尾差调整（演示Step2）', operator: '支付平台阿南', operatorRole: 'product_manager', affectedResults: '对账说明自动更新，增加尾差调整说明' });
            const updatedNote3 = generateReconciliationNote(r3, true);
            Object.assign(r3, { whyKept: updatedNote3.whyKept, missingMaterials: updatedNote3.missingMaterials, nextAction: updatedNote3.nextAction, lastUpdatedBy: '系统', lastUpdatedAt: now });
        }
        saveData(db);
    }
    if (step === '3' || !step) {
        const record = db.records.find((r) => r.id === 'demo-001');
        if (record) {
            const oldWhyKept = record.whyKept;
            const hasAdj = db.adjustments.some((a) => a.recordId === 'demo-001');
            if (!hasAdj) {
                const adj = { id: (0, uuid_1.v4)(), recordId: 'demo-001', amount: 125.50, reason: '银行手续费尾差调整', adjustedBy: '支付平台阿南', adjustedAt: now, affectsReconciliation: true };
                db.adjustments.unshift(adj);
                addAuditLog({ recordId: 'demo-001', action: 'adjust', reason: '银行手续费尾差调整（演示Step3）', operator: '支付平台阿南', operatorRole: 'product_manager', affectedResults: '对账说明自动更新，增加尾差调整说明' });
            }
            const note = generateReconciliationNote(record, true);
            Object.assign(record, { whyKept: note.whyKept, missingMaterials: note.missingMaterials, nextAction: note.nextAction, lastUpdatedBy: '支付平台阿南', lastUpdatedAt: now, updatedAt: now });
            addAuditLog({ recordId: record.id, action: 'modify', fieldName: 'reconciliation_note', oldValue: oldWhyKept, newValue: record.whyKept, reason: '对账说明更新（演示Step3）', operator: '支付平台阿南', operatorRole: 'product_manager', affectedResults: '对账说明已更新' });
            addAuditLog({ recordId: record.id, action: 'rerun', fieldName: 'reconciliation', oldValue: oldWhyKept, newValue: record.whyKept, reason: '重跑对账逻辑（演示Step3）', operator: '支付平台阿南', operatorRole: 'product_manager', affectedResults: '对账说明已重新生成' });
        }
        saveData(db);
    }
    res.json({ success: true, data: { message: step ? `Step${step}已完成` : '完整演示数据已初始化', demoGuide: { title: '期货交割仓单核查流程演示', keyScenarios: ['节假日顺延说明', '尾差调整条', '一次人工修正(T+1→T+2)', '一次重跑'], threeStepFlow: ['Step1: 节假日顺延导入 → 自动标记T+1→T+2修改', 'Step2: 补录尾差调整条 → 对账说明自动更新', 'Step3: 对账说明更新 → 保留异常状态待基金经理复核'] } } });
});
app.get('/api/demo/guide', (req, res) => {
    res.json({ success: true, data: { title: '期货交割仓单核查系统使用指南', forRole: '支付平台产品阿南', threeStepProcess: [{ step: 1, name: '导入数据', action: '导入包含节假日顺延的交割仓单数据', systemResponse: '系统自动标记T+1→T+2等人工修改记录，生成对账说明', keyPoint: 'T+1→T+2修改会被高亮标记，留待基金经理复核' }, { step: 2, name: '补录尾差调整', action: '补录尾差调整条，填写调整金额和原因', systemResponse: '系统自动更新所有关联记录的对账说明', keyPoint: '尾差调整后，对账说明会自动增加"已补录尾差调整条"说明' }, { step: 3, name: '对账说明更新', action: '查看更新后的对账说明，确认信息完整', systemResponse: '对账说明包含：为什么被留下、缺什么材料、下一步找谁', keyPoint: 'T+1→T+2修改记录保持reviewing状态，不自动归正常' }], auditTrail: { description: '每一条记录都完整记录：', items: ['谁在什么时间改了什么', '为什么改（修改原因）', '改完影响哪些结果'] } } });
});
app.post('/api/demo/reset', (req, res) => {
    db.records = db.records.filter((r) => !r.id.startsWith('demo-'));
    db.adjustments = [];
    db.auditLogs = [];
    db.reviews = [];
    saveData(db);
    res.json({ success: true, message: '演示数据已重置' });
});
app.get('/api/demo/holidays', (req, res) => {
    res.json({ success: true, data: db.holidays });
});
app.get('/api/demo/calculate-expected-date', (req, res) => {
    const { tradeDate } = req.query;
    if (!tradeDate)
        return res.status(400).json({ success: false, message: '请提供交易日期' });
    const expectedDate = calculateExpectedArrivalDate(tradeDate);
    res.json({ success: true, data: { tradeDate, expectedArrivalDate: expectedDate, explanation: `T+1计算结果：${expectedDate}（已扣除节假日和周末）` } });
});
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: '期货交割仓单核查系统API服务正常', timestamp: new Date().toISOString() });
});
app.get('/api', (req, res) => {
    res.json({ success: true, message: '欢迎使用期货交割仓单核查系统API', endpoints: { records: '/api/records', adjustments: '/api/adjustments', audit: '/api/audit', demo: '/api/demo' } });
});
app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════════════════════╗
║   期货交割仓单核查系统 API 服务已启动                         ║
╠══════════════════════════════════════════════════════════════╣
║   服务地址: http://localhost:${PORT}                           ║
║   演示数据: GET /api/demo/init                                ║
╚══════════════════════════════════════════════════════════════╝\n`);
});
//# sourceMappingURL=index.js.map