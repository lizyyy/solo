const { runInspection } = require('./src/inspectionEngine');
const { importDesensitizationRule, clearAllData } = require('./src/models');

clearAllData();
importDesensitizationRule({ name: 't', remark: '缺少RAG引用', mainProcess: 't', content: 't' }, 't');
const r = runInspection('t');

console.log('inspection.gaps:', r.inspection.gaps ? 'exists len=' + r.inspection.gaps.length : 'missing');
console.log('inspection.phoneIssues:', r.inspection.phoneIssues ? 'exists len=' + r.inspection.phoneIssues.length : 'missing');
console.log('friendlyReport:', typeof r.friendlyReport);
console.log('exportResult keys:', Object.keys(r.exportResult));
console.log('gapsSummary:', r.exportResult.gapsSummary);
console.log('phoneIssuesSummary:', r.exportResult.phoneIssuesSummary);
