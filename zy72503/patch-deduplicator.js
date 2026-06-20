
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/utils/deduplicator.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('开始修改 deduplicator.ts...\n');

// 1. 添加 deterministicTicketUrl 函数
if (!content.includes('deterministicTicketUrl')) {
  const insertPoint = 'const hashToTime = (str: string): string => {';
  const newFunc = `
const deterministicTicketUrl = (sampleNumber: string): string => {
  const hash = simpleHash(\`\${sampleNumber}_ticket\`);
  return \`https://ticket.example.com/feedback/\${hash.toString(36)}\`;
};

const hashToTime = (str: string): string => {`;
  
  content = content.replace(insertPoint, newFunc);
  console.log('✅ 添加了 deterministicTicketUrl 函数');
} else {
  console.log('ℹ️  deterministicTicketUrl 已存在');
}

// 2. 给版本变更的 newConflict 添加 ticketUrl
const oldPattern1 = `sourceUrl: link.url,
        isModelVersionChanged: true,`;
const newPattern1 = `sourceUrl: link.url,
        ticketUrl: deterministicTicketUrl(link.sampleNumber),
        isModelVersionChanged: true,`;

if (content.includes(oldPattern1)) {
  content = content.replace(oldPattern1, newPattern1);
  console.log('✅ 版本变更冲突添加了 ticketUrl');
} else {
  console.log('ℹ️  版本变更 ticketUrl 已添加或模式不匹配');
}

// 3. 给首次导入的 newConflict 添加 ticketUrl
const oldPattern2 = `sourceUrl: link.url,
          isModelVersionChanged: false,`;
const newPattern2 = `sourceUrl: link.url,
          ticketUrl: deterministicTicketUrl(link.sampleNumber),
          isModelVersionChanged: false,`;

if (content.includes(oldPattern2)) {
  content = content.replace(oldPattern2, newPattern2);
  console.log('✅ 首次导入冲突添加了 ticketUrl');
} else {
  console.log('ℹ️  首次导入 ticketUrl 已添加或模式不匹配');
}

// 4. 添加 generateExportReport 函数
if (!content.includes('generateExportReport')) {
  const exportFunc = `
export const generateExportReport = (
  conflicts: Conflict[],
  batchId?: string
): string => {
  const filtered = batchId 
    ? conflicts.filter(c => c.importBatch === batchId || c.previousModelVersion)
    : conflicts;

  const header = '样本编号,模型版本,历史版本,标签A,标签B,置信度A,置信度B,状态,是否版本变更,首次来源批次,知识库链接,线上工单链接,当前备注';
  const rows = filtered.map(c => {
    const remark = (c.currentRemark || '').replace(/"/g, '""');
    return [
      c.sampleNumber,
      c.modelVersion,
      c.previousModelVersion || '-',
      c.labelA,
      c.labelB,
      c.confidenceA.toFixed(2),
      c.confidenceB.toFixed(2),
      c.status,
      c.isModelVersionChanged ? '是' : '否',
      c.importBatch,
      c.sourceUrl,
      c.ticketUrl || '-',
      \`"\${remark}"\`,
    ].join(',');
  });

  return [header, ...rows].join('\\n');
};
`;
  content += exportFunc;
  console.log('✅ 添加了 generateExportReport 函数');
} else {
  console.log('ℹ️  generateExportReport 已存在');
}

fs.writeFileSync(filePath, content);
console.log('\n✅ deduplicator.ts 修改完成，已保存');
