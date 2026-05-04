const express = require('express');
const Rehearsal = require('../models/Rehearsal');
const Level = require('../models/Level');

const router = express.Router();

function generateMarkdownReport(rehearsal, level) {
  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleString('zh-CN');
  };

  const deductionTypeMap = {
    'timeout': '超时',
    'misplaced': '错位',
    'danger': '危险占道',
    'missing': '遗漏动作'
  };

  let markdown = `# 换景复盘报告\n\n`;
  markdown += `## 基本信息\n\n`;
  markdown += `- **关卡名称**: ${rehearsal.levelName || level?.name || '未知'}\n`;
  markdown += `- **排练时间**: ${formatTime(rehearsal.startTime)}\n`;
  markdown += `- **总分**: ${rehearsal.totalScore} 分\n`;
  markdown += `- **排练时长**: ${Math.round((new Date(rehearsal.endTime) - new Date(rehearsal.startTime)) / 1000)} 秒\n\n`;

  markdown += `## 扣分详情\n\n`;
  if (rehearsal.deductions && rehearsal.deductions.length > 0) {
    markdown += `| 序号 | 扣分类型 | 扣分分值 | 时间点 | 描述 |\n`;
    markdown += `|------|----------|----------|--------|------|\n`;
    rehearsal.deductions.forEach((d, index) => {
      markdown += `| ${index + 1} | ${deductionTypeMap[d.type] || d.type} | -${d.points} | ${d.timestamp}s | ${d.description} |\n`;
    });
    markdown += `\n`;
  } else {
    markdown += `本次排练无扣分记录。\n\n`;
  }

  markdown += `## 动作记录\n\n`;
  if (rehearsal.actions && rehearsal.actions.length > 0) {
    rehearsal.actions.forEach((action, index) => {
      markdown += `### 动作 ${index + 1}: ${action.type}\n\n`;
      markdown += `- **时间点**: ${action.timestamp}s\n`;
      markdown += `- **对象**: ${action.target || '未知'}\n`;
      markdown += `- **位置**: (${action.x}, ${action.y})\n\n`;
    });
  } else {
    markdown += `无动作记录。\n\n`;
  }

  if (rehearsal.notes) {
    markdown += `## 复盘备注\n\n`;
    markdown += `${rehearsal.notes}\n\n`;
  }

  markdown += `---\n`;
  markdown += `*报告生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;

  return markdown;
}

function generateAuditPackage(rehearsal, level) {
  return {
    version: '1.0',
    exportTime: new Date().toISOString(),
    rehearsal: {
      id: rehearsal.id,
      levelId: rehearsal.levelId,
      levelName: rehearsal.levelName,
      startTime: rehearsal.startTime,
      endTime: rehearsal.endTime,
      totalScore: rehearsal.totalScore,
      actions: rehearsal.actions,
      deductions: rehearsal.deductions,
      notes: rehearsal.notes
    },
    level: level ? {
      id: level.id,
      name: level.name,
      description: level.description,
      sceneData: level.sceneData,
      propsList: level.propsList,
      timeline: level.timeline,
      stageConfig: level.stageConfig
    } : null,
    statistics: {
      totalActions: rehearsal.actions?.length || 0,
      totalDeductions: rehearsal.deductions?.length || 0,
      totalPointsLost: rehearsal.deductions?.reduce((sum, d) => sum + d.points, 0) || 0,
      duration: rehearsal.endTime && rehearsal.startTime 
        ? Math.round((new Date(rehearsal.endTime) - new Date(rehearsal.startTime)) / 1000) 
        : 0
    }
  };
}

router.get('/markdown/:rehearsalId', (req, res) => {
  try {
    const { rehearsalId } = req.params;
    const rehearsal = Rehearsal.getById(rehearsalId);
    
    if (!rehearsal) {
      return res.status(404).json({ 
        error: '排练记录不存在', 
        message: '未找到指定的排练记录' 
      });
    }
    
    const level = Level.getById(rehearsal.levelId);
    const markdown = generateMarkdownReport(rehearsal, level);
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rehearsal-${rehearsalId}.md"`);
    res.send(markdown);
  } catch (error) {
    console.error('生成 Markdown 报告失败:', error);
    res.status(500).json({ 
      error: '生成报告失败', 
      message: error.message 
    });
  }
});

router.get('/json/:rehearsalId', (req, res) => {
  try {
    const { rehearsalId } = req.params;
    const rehearsal = Rehearsal.getById(rehearsalId);
    
    if (!rehearsal) {
      return res.status(404).json({ 
        error: '排练记录不存在', 
        message: '未找到指定的排练记录' 
      });
    }
    
    const level = Level.getById(rehearsal.levelId);
    const auditPackage = generateAuditPackage(rehearsal, level);
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${rehearsalId}.json"`);
    res.json(auditPackage);
  } catch (error) {
    console.error('生成 JSON 审计包失败:', error);
    res.status(500).json({ 
      error: '生成审计包失败', 
      message: error.message 
    });
  }
});

module.exports = router;
