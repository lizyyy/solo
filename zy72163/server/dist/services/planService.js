"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlanVersion = createPlanVersion;
exports.getPlanById = getPlanById;
exports.getPlansByLocation = getPlansByLocation;
exports.getAllPlans = getAllPlans;
exports.updatePlan = updatePlan;
exports.createReportFromPlan = createReportFromPlan;
exports.getReportById = getReportById;
exports.getReportsByLocation = getReportsByLocation;
exports.getReportsByPlan = getReportsByPlan;
exports.updateReport = updateReport;
exports.getFullLocationTimeline = getFullLocationTimeline;
const database_1 = __importDefault(require("../database"));
const utils_1 = require("../utils");
function createPlanVersion(data) {
    const existingVersions = database_1.default.plan_versions.filter((p) => p.locationId === data.locationId).map((p) => p.version);
    const version = (0, utils_1.generateVersion)(existingVersions);
    const result = database_1.default.plan_versions.insert({
        locationId: data.locationId,
        version,
        title: data.title,
        description: data.description || null,
        pruningType: data.pruningType,
        estimatedDate: data.estimatedDate || null,
        contractor: data.contractor || null,
        cost: data.cost || null,
        status: data.status || 'draft',
        createdBy: data.createdBy,
        parentVersionId: data.parentVersionId || null
    });
    return database_1.default.plan_versions.get(result.lastInsertRowid);
}
function getPlanById(id) {
    return database_1.default.plan_versions.get(id);
}
function getPlansByLocation(locationId) {
    return database_1.default.plan_versions.filter((p) => p.locationId === locationId).sort((a, b) => {
        const va = parseFloat(a.version);
        const vb = parseFloat(b.version);
        if (vb !== va)
            return vb - va;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}
function getAllPlans(filters) {
    let results = database_1.default.plan_versions.all();
    if (filters?.status) {
        results = results.filter((p) => p.status === filters.status);
    }
    if (filters?.locationId) {
        results = results.filter((p) => p.locationId === filters.locationId);
    }
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return results;
}
function updatePlan(id, updates) {
    const { id: _, createdAt: __, locationId: ___, version: ____, createdBy: _____, ...data } = updates;
    database_1.default.plan_versions.update(id, data);
    return getPlanById(id);
}
function createReportFromPlan(planId, generatedBy, customContent) {
    const plan = getPlanById(planId);
    if (!plan)
        throw new Error('方案不存在');
    const feedbacks = database_1.default.resident_feedbacks.filter((f) => f.locationId === plan.locationId).sort((a, b) => new Date(b.feedbackDate).getTime() - new Date(a.feedbackDate).getTime());
    const feedbackContent = feedbacks.map((f) => `- [${f.feedbackDate}] ${f.reporter || '匿名'}: ${f.content}`).join('\n') || '无相关居民反馈';
    const suggestion = (0, utils_1.generatePruningSuggestion)(feedbacks[0]?.content || plan.description || '', plan.title);
    const reportNo = (0, utils_1.generateReportNo)();
    const content = customContent || `
# ${plan.title} - 修剪执行报告

## 一、基本信息
- 报告编号：${reportNo}
- 方案版本：${plan.version}
- 修剪类型：${plan.pruningType}
- 计划日期：${plan.estimatedDate || '待定'}
- 施工单位：${plan.contractor || '待定'}
- 预计费用：${plan.cost ? `¥${plan.cost}` : '待定'}

## 二、居民反馈汇总
${feedbackContent}

## 三、修剪作业建议
${suggestion}

## 四、现场情况（待填写）
[此处填写现场勘查实际情况]

## 五、修剪后效果
[此处填写修剪后照片及说明]

## 六、存在问题及后续措施
[此处记录发现的问题及跟进计划]
  `.trim();
    const result = database_1.default.reports.insert({
        planVersionId: planId,
        locationId: plan.locationId,
        reportNo,
        title: `${plan.title} - 修剪报告`,
        content,
        pruningDetails: null,
        issuesFound: null,
        followUpActions: null,
        status: 'draft',
        generatedBy,
        generatedAt: new Date().toISOString()
    });
    return database_1.default.reports.get(result.lastInsertRowid);
}
function getReportById(id) {
    return database_1.default.reports.get(id);
}
function getReportsByLocation(locationId) {
    return database_1.default.reports.filter((r) => r.locationId === locationId).sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}
function getReportsByPlan(planId) {
    return database_1.default.reports.filter((r) => r.planVersionId === planId).sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}
function updateReport(id, updates) {
    const { id: _, generatedAt: __, planVersionId: ___, locationId: ____, reportNo: _____, generatedBy: ______, ...data } = updates;
    database_1.default.reports.update(id, data);
    return getReportById(id);
}
function getFullLocationTimeline(locationId) {
    const feedbacks = database_1.default.resident_feedbacks.filter((f) => f.locationId === locationId).map((f) => ({
        id: f.id,
        type: 'feedback',
        date: f.feedbackDate,
        content: f.content,
        status: f.status,
        priority: f.priority,
        createdAt: f.createdAt
    }));
    const plans = database_1.default.plan_versions.filter((p) => p.locationId === locationId).map((p) => ({
        id: p.id,
        type: 'plan',
        date: p.estimatedDate,
        content: p.title,
        status: p.status,
        version: p.version,
        createdAt: p.createdAt
    }));
    const reports = database_1.default.reports.filter((r) => r.locationId === locationId).map((r) => ({
        id: r.id,
        type: 'report',
        date: r.generatedAt,
        content: r.title,
        status: r.status,
        reportNo: r.reportNo,
        createdAt: r.generatedAt
    }));
    const timeline = [...feedbacks, ...plans, ...reports].sort((a, b) => {
        return new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime();
    });
    return timeline;
}
