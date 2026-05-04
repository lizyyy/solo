const express = require('express');
const moment = require('moment');
const FileManager = require('../utils/fileManager');

const router = express.Router();

router.get('/markdown/:id', (req, res) => {
  try {
    const { id } = req.params;
    const schedule = FileManager.loadSchedule(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: '排程不存在'
      });
    }

    const markdown = generateMarkdownReport(schedule);

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=schedule_${id}_report.md`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '生成Markdown报告失败: ' + error.message
    });
  }
});

router.get('/json/:id', (req, res) => {
  try {
    const { id } = req.params;
    const schedule = FileManager.loadSchedule(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: '排程不存在'
      });
    }

    const auditPackage = generateAuditPackage(schedule);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=schedule_${id}_audit.json`);
    res.send(JSON.stringify(auditPackage, null, 2));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '生成JSON审计包失败: ' + error.message
    });
  }
});

router.post('/markdown', (req, res) => {
  try {
    const schedule = req.body;

    if (!schedule) {
      return res.status(400).json({
        success: false,
        error: '缺少排程数据'
      });
    }

    const markdown = generateMarkdownReport(schedule);

    res.json({
      success: true,
      data: { markdown }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '生成Markdown报告失败: ' + error.message
    });
  }
});

router.post('/json', (req, res) => {
  try {
    const schedule = req.body;

    if (!schedule) {
      return res.status(400).json({
        success: false,
        error: '缺少排程数据'
      });
    }

    const auditPackage = generateAuditPackage(schedule);

    res.json({
      success: true,
      data: auditPackage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '生成JSON审计包失败: ' + error.message
    });
  }
});

function generateMarkdownReport(schedule) {
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  const scheduleTime = schedule.generatedAt 
    ? moment(schedule.generatedAt).format('YYYY-MM-DD HH:mm:ss')
    : '未知';

  let md = `# 潮汐装卸排程交班单

> 生成时间: ${now}
> 排程时间: ${scheduleTime}

---

## 一、排程概览

| 项目 | 详情 |
|------|------|
| 驳船总数 | ${schedule.barges?.length || 0} 艘 |
| 已分配泊位 | ${countAssignedBarges(schedule)} 艘 |
| 冲突数量 | ${schedule.conflicts?.length || 0} 个 |
| 警告数量 | ${schedule.warnings?.length || 0} 个 |

---

## 二、驳船排程详情

`;

  if (schedule.barges && schedule.barges.length > 0) {
    for (const barge of schedule.barges) {
      md += `### ${barge.name}

| 属性 | 值 |
|------|-----|
| 吃水 | ${barge.draft || '-'} m |
| 货种 | ${barge.cargoType || '-'} |
| 预计装卸时间 | ${barge.loadingTime || 120} 分钟 |
| 可用时间窗 | ${barge.availableWindows?.length || 0} 个 |

`;

      if (barge.assignedTime && barge.assignedBerth) {
        const start = moment(barge.assignedTime.startTime).format('MM-DD HH:mm');
        const end = moment(barge.assignedTime.endTime).format('MM-DD HH:mm');
        
        md += `**分配信息:**
- 泊位: ${barge.assignedBerth.name}
- 作业时间: ${start} - ${end}
- 最低潮位: ${barge.assignedTime.minHeight?.toFixed(2) || '-'} m
- 最高流速: ${barge.assignedTime.maxCurrent?.toFixed(2) || '-'} 节

`;
      } else {
        md += `**状态:** ⚠️ 未分配

`;
      }

      if (barge.availableWindows && barge.availableWindows.length > 0) {
        md += `**可选时间窗:**

| 序号 | 开始时间 | 结束时间 | 最低潮位 | 最高流速 | 状态 |
|------|----------|----------|----------|----------|------|
`;

        barge.availableWindows.forEach((window, idx) => {
          const start = moment(window.startTime).format('MM-DD HH:mm');
          const end = moment(window.endTime).format('MM-DD HH:mm');
          const issues = window.issues?.length > 0 ? '⚠️ 有警告' : '✅ 正常';
          
          md += `| ${idx + 1} | ${start} | ${end} | ${window.minHeight?.toFixed(2) || '-'} m | ${window.maxCurrent?.toFixed(2) || '-'} 节 | ${issues} |
`;
        });
        md += '\n';
      }

      const bargeNotes = schedule.bargeNotes?.[barge.id] || schedule.bargeNotes?.[barge.name];
      if (bargeNotes) {
        md += `**备注:** ${bargeNotes}

`;
      }

      md += '---\n\n';
    }
  } else {
    md += `暂无驳船数据

---

`;
  }

  if (schedule.conflicts && schedule.conflicts.length > 0) {
    md += `## 三、冲突警告

### 严重冲突

`;
    for (const conflict of schedule.conflicts) {
      md += `- [${conflict.severity === 'critical' ? '🔴' : '🟡'}] ${conflict.message}\n`;
    }
    md += '\n---\n\n';
  }

  if (schedule.warnings && schedule.warnings.length > 0) {
    md += `## 四、其他警告

`;
    for (const warning of schedule.warnings) {
      md += `- [${warning.severity === 'critical' ? '🔴' : '🟡'}] ${warning.message}\n`;
    }
    md += '\n---\n\n';
  }

  if (schedule.notes?.general) {
    md += `## 五、交班备注

${schedule.notes.general}

---

`;
  }

  md += `## 六、复核确认

| 岗位 | 签名 | 时间 |
|------|------|------|
| 调度员 | ____________ | ____________ |
| 值班长 | ____________ | ____________ |

---

*此报告由潮汐排程系统自动生成*
`;

  return md;
}

function countAssignedBarges(schedule) {
  if (!schedule.barges) return 0;
  return schedule.barges.filter(b => b.assignedTime && b.assignedBerth).length;
}

function generateAuditPackage(schedule) {
  return {
    version: '1.0',
    auditInfo: {
      generatedAt: new Date().toISOString(),
      scheduleGeneratedAt: schedule.generatedAt,
      scheduleUpdatedAt: schedule.updatedAt
    },
    originalSchedule: {
      barges: schedule.barges || [],
      conflicts: schedule.conflicts || [],
      warnings: schedule.warnings || []
    },
    adjustments: schedule.adjustments || [],
    notes: {
      general: schedule.notes?.general || '',
      bargeNotes: schedule.bargeNotes || {}
    },
    validationHistory: schedule.validationHistory || [],
    metadata: {
      name: schedule.name || '未命名排程',
      id: schedule.id
    }
  };
}

module.exports = router;
