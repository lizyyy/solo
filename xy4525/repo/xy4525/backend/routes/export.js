const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const STORAGE_FILE = path.join(__dirname, '../data/storage.json');

function readStorage() {
  const content = fs.readFileSync(STORAGE_FILE, 'utf8');
  return JSON.parse(content);
}

router.get('/markdown/:batchId', (req, res) => {
  const storage = readStorage();
  const batch = storage.batches.find(b => b.id === req.params.batchId);
  const review = storage.reviews.find(r => r.batchId === req.params.batchId);
  
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const markdown = generateMarkdownReport(batch, review);
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="质检单-${batch.batchNumber}.md"`);
  res.send(markdown);
});

router.get('/json/:batchId', (req, res) => {
  const storage = readStorage();
  const batch = storage.batches.find(b => b.id === req.params.batchId);
  const review = storage.reviews.find(r => r.batchId === req.params.batchId);
  
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const jsonData = {
    batch: batch,
    review: review || null,
    exportTime: new Date().toISOString()
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="质检明细-${batch.batchNumber}.json"`);
  res.json(jsonData);
});

router.get('/json/all', (req, res) => {
  const storage = readStorage();
  
  const allData = {
    batches: storage.batches,
    reviews: storage.reviews,
    exportTime: new Date().toISOString(),
    totalBatches: storage.batches.length
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="全部质检数据-${new Date().toISOString().split('T')[0]}.json"`);
  res.json(allData);
});

function generateMarkdownReport(batch, review) {
  const riskColors = {
    high: '🔴 高风险',
    medium: '🟡 中风险',
    low: '🟢 低风险'
  };

  const decisionText = {
    pass: '✅ 合格',
    fail: '❌ 不合格',
    pending: '⏳ 待复核',
    reviewed: '✍️ 已复核'
  };

  let markdown = `# 粮食质量检验报告单\n\n`;
  
  markdown += `## 基本信息\n\n`;
  markdown += `| 项目 | 内容 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 批次号 | ${batch.batchNumber || '-'} |\n`;
  markdown += `| 粮仓 | ${batch.warehouse || '-'} |\n`;
  markdown += `| 粮食品种 | ${batch.grainType || '-'} |\n`;
  markdown += `| 检验日期 | ${batch.inspectionDate || '-'} |\n`;
  markdown += `| 风险等级 | ${riskColors[batch.riskLevel] || '-'} |\n`;
  markdown += `| 检验状态 | ${decisionText[batch.status] || '-'} |\n\n`;

  if (batch.analysis) {
    markdown += `## AI初筛结果\n\n`;
    
    if (batch.analysis.image) {
      markdown += `### 图像分析结果\n\n`;
      markdown += `| 检测项 | 置信度 | 证据 |\n`;
      markdown += `|--------|--------|------|\n`;
      markdown += `| 虫蛀 | ${(batch.analysis.image.insectDamage?.confidence * 100).toFixed(1)}% | ${batch.analysis.image.insectDamage?.evidence || '-'} |\n`;
      markdown += `| 霉变 | ${(batch.analysis.image.mold?.confidence * 100).toFixed(1)}% | ${batch.analysis.image.mold?.evidence || '-'} |\n`;
      markdown += `| 杂质 | ${(batch.analysis.image.impurities?.confidence * 100).toFixed(1)}% | ${batch.analysis.image.impurities?.evidence || '-'} |\n\n`;
    }
    
    if (batch.analysis.moisture) {
      markdown += `### 水分含量分析\n\n`;
      markdown += `| 项目 | 数值 |\n`;
      markdown += `|------|------|\n`;
      markdown += `| 平均水分 | ${batch.analysis.moisture.average?.toFixed(1) || '-'}% |\n`;
      markdown += `| 最高水分 | ${batch.analysis.moisture.max?.toFixed(1) || '-'}% |\n`;
      markdown += `| 最低水分 | ${batch.analysis.moisture.min?.toFixed(1) || '-'}% |\n`;
      markdown += `| 检测点数 | ${batch.analysis.moisture.samples || '-'} |\n`;
      markdown += `| 置信度 | ${(batch.analysis.moisture.confidence * 100).toFixed(1)}% |\n\n`;
      markdown += `**分析结论**: ${batch.analysis.moisture.evidence || '-'}\n\n`;
    }
    
    if (batch.analysis.temperature) {
      markdown += `### 仓温分析\n\n`;
      markdown += `| 项目 | 数值 |\n`;
      markdown += `|------|------|\n`;
      markdown += `| 平均仓温 | ${batch.analysis.temperature.average?.toFixed(1) || '-'}℃ |\n`;
      markdown += `| 最高仓温 | ${batch.analysis.temperature.max?.toFixed(1) || '-'}℃ |\n`;
      markdown += `| 最低仓温 | ${batch.analysis.temperature.min?.toFixed(1) || '-'}℃ |\n`;
      markdown += `| 检测区域 | ${batch.analysis.temperature.zones || '-'} 个 |\n`;
      markdown += `| 置信度 | ${(batch.analysis.temperature.confidence * 100).toFixed(1)}% |\n\n`;
      markdown += `**分析结论**: ${batch.analysis.temperature.evidence || '-'}\n\n`;
    }
  }

  if (review) {
    markdown += `## 人工复核结果\n\n`;
    markdown += `| 项目 | 内容 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 复核人员 | ${review.reviewer || '-'} |\n`;
    markdown += `| 复核结论 | ${decisionText[review.decision] || '-'} |\n`;
    markdown += `| 复核时间 | ${review.updatedAt || review.createdAt} |\n\n`;
    
    if (review.comments) {
      markdown += `### 复核意见\n\n`;
      markdown += `${review.comments}\n\n`;
    }
    
    if (review.correctedAnalysis) {
      markdown += `### 修正分析\n\n`;
      markdown += `\`\`\`json\n${JSON.stringify(review.correctedAnalysis, null, 2)}\n\`\`\`\n\n`;
    }
  }

  markdown += `---\n\n`;
  markdown += `*报告生成时间: ${new Date().toISOString()}*\n`;
  markdown += `*检验工具: 县粮库AI初筛系统*\n`;

  return markdown;
}

module.exports = router;
