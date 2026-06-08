import db from '../database';
import { generateVersion, generatePruningSuggestion, generateReportNo } from '../utils';
import type { PlanVersion, Report } from '../types';

export function createPlanVersion(data: {
  locationId: number;
  parentVersionId?: number;
  title: string;
  description?: string;
  pruningType: string;
  estimatedDate?: string;
  contractor?: string;
  cost?: number;
  status?: string;
  createdBy: string;
}): PlanVersion {
  const existingVersions = db.plan_versions.filter((p: any) => p.locationId === data.locationId).map((p: any) => p.version);

  const version = generateVersion(existingVersions);

  const result = db.plan_versions.insert({
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

  return db.plan_versions.get(result.lastInsertRowid) as PlanVersion;
}

export function getPlanById(id: number): PlanVersion | undefined {
  return db.plan_versions.get(id) as PlanVersion | undefined;
}

export function getPlansByLocation(locationId: number): PlanVersion[] {
  return db.plan_versions.filter((p: any) => p.locationId === locationId).sort((a: any, b: any) => {
    const va = parseFloat(a.version);
    const vb = parseFloat(b.version);
    if (vb !== va) return vb - va;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }) as PlanVersion[];
}

export function getAllPlans(filters?: {
  status?: string;
  locationId?: number;
}): PlanVersion[] {
  let results = db.plan_versions.all();

  if (filters?.status) {
    results = results.filter((p: any) => p.status === filters.status);
  }
  if (filters?.locationId) {
    results = results.filter((p: any) => p.locationId === filters.locationId);
  }

  results.sort((a: any, b: any) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return results as PlanVersion[];
}

export function updatePlan(id: number, updates: Partial<PlanVersion>): PlanVersion | undefined {
  const { id: _, createdAt: __, locationId: ___, version: ____, createdBy: _____, ...data } = updates as any;
  db.plan_versions.update(id, data);
  return getPlanById(id);
}

export function createReportFromPlan(planId: number, generatedBy: string, customContent?: string): Report {
  const plan = getPlanById(planId);
  if (!plan) throw new Error('方案不存在');

  const feedbacks = db.resident_feedbacks.filter((f: any) => f.locationId === plan.locationId).sort((a: any, b: any) => 
    new Date(b.feedbackDate).getTime() - new Date(a.feedbackDate).getTime()
  );

  const feedbackContent = feedbacks.map((f: any) => 
    `- [${f.feedbackDate}] ${f.reporter || '匿名'}: ${f.content}`
  ).join('\n') || '无相关居民反馈';

  const suggestion = generatePruningSuggestion(
    feedbacks[0]?.content || plan.description || '',
    plan.title
  );

  const reportNo = generateReportNo();
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

  const result = db.reports.insert({
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

  return db.reports.get(result.lastInsertRowid) as Report;
}

export function getReportById(id: number): Report | undefined {
  return db.reports.get(id) as Report | undefined;
}

export function getReportsByLocation(locationId: number): Report[] {
  return db.reports.filter((r: any) => r.locationId === locationId).sort((a: any, b: any) => 
    new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  ) as Report[];
}

export function getReportsByPlan(planId: number): Report[] {
  return db.reports.filter((r: any) => r.planVersionId === planId).sort((a: any, b: any) => 
    new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  ) as Report[];
}

export function updateReport(id: number, updates: Partial<Report>): Report | undefined {
  const { id: _, generatedAt: __, planVersionId: ___, locationId: ____, reportNo: _____, generatedBy: ______, ...data } = updates as any;
  db.reports.update(id, data);
  return getReportById(id);
}

export function getFullLocationTimeline(locationId: number) {
  const feedbacks = db.resident_feedbacks.filter((f: any) => f.locationId === locationId).map((f: any) => ({
    id: f.id,
    type: 'feedback',
    date: f.feedbackDate,
    content: f.content,
    status: f.status,
    priority: f.priority,
    createdAt: f.createdAt
  }));

  const plans = db.plan_versions.filter((p: any) => p.locationId === locationId).map((p: any) => ({
    id: p.id,
    type: 'plan',
    date: p.estimatedDate,
    content: p.title,
    status: p.status,
    version: p.version,
    createdAt: p.createdAt
  }));

  const reports = db.reports.filter((r: any) => r.locationId === locationId).map((r: any) => ({
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
