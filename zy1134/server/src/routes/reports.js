import express from 'express';
import { query, validationResult } from 'express-validator';
import { ERROR_TAGS } from '../utils/musicTheory.js';

const router = express.Router();

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };
};

// 生成报告数据
const generateReportData = async (db, userId, startDate, endDate) => {
  // 总体统计
  const overview = db.prepare(`
    SELECT 
      COUNT(DISTINCT ps.id) as total_sessions,
      COUNT(a.id) as total_answers,
      SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
      ROUND(
        CASE WHEN COUNT(a.id) > 0 
          THEN (SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)) 
          ELSE 0 
        END, 2
      ) as overall_accuracy
    FROM practice_sessions ps
    LEFT JOIN answers a ON ps.id = a.session_id
    WHERE ps.user_id = ?
      AND (? IS NULL OR ps.created_at >= ?)
      AND (? IS NULL OR ps.created_at <= ?)
  `).get(userId, startDate, startDate, endDate, endDate);

  // 按知识点统计
  const byKnowledgePoint = db.prepare(`
    SELECT 
      kp.id,
      kp.name,
      kp.category,
      COUNT(a.id) as total_answers,
      SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
      ROUND(
        CASE WHEN COUNT(a.id) > 0 
          THEN (SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)) 
          ELSE 0 
        END, 2
      ) as accuracy
    FROM knowledge_points kp
    JOIN questions q ON kp.id = q.knowledge_point_id
    JOIN answers a ON q.id = a.question_id AND a.user_id = ?
    WHERE 1=1
      AND (? IS NULL OR a.created_at >= ?)
      AND (? IS NULL OR a.created_at <= ?)
    GROUP BY kp.id, kp.name, kp.category
    ORDER BY accuracy ASC
  `).all(userId, startDate, startDate, endDate, endDate);

  // 按题目类型统计
  const byQuestionType = db.prepare(`
    SELECT 
      q.type,
      COUNT(a.id) as total_answers,
      SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
      ROUND(
        CASE WHEN COUNT(a.id) > 0 
          THEN (SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)) 
          ELSE 0 
        END, 2
      ) as accuracy
    FROM questions q
    JOIN answers a ON q.id = a.question_id AND a.user_id = ?
    WHERE 1=1
      AND (? IS NULL OR a.created_at >= ?)
      AND (? IS NULL OR a.created_at <= ?)
    GROUP BY q.type
    ORDER BY accuracy ASC
  `).all(userId, startDate, startDate, endDate, endDate);

  // 错因分布
  const errorTagCounts = db.prepare(`
    SELECT 
      json_extract(value, '$') as tag,
      COUNT(*) as count
    FROM wrong_notes wn,
         json_each(wn.error_tags)
    WHERE wn.user_id = ? AND wn.status = 'active'
      AND (? IS NULL OR wn.created_at >= ?)
      AND (? IS NULL OR wn.created_at <= ?)
    GROUP BY tag
    ORDER BY count DESC
  `).all(userId, startDate, startDate, endDate, endDate);

  // 代表性错题（活跃错题中最近的10道）
  const representativeWrongNotes = db.prepare(`
    SELECT 
      wn.id,
      wn.created_at,
      wn.error_tags,
      q.type,
      q.difficulty,
      q.content,
      q.correct_answer,
      q.explanation,
      a.user_answer
    FROM wrong_notes wn
    JOIN questions q ON wn.question_id = q.id
    JOIN answers a ON wn.answer_id = a.id
    WHERE wn.user_id = ? AND wn.status = 'active'
      AND (? IS NULL OR wn.created_at >= ?)
      AND (? IS NULL OR wn.created_at <= ?)
    ORDER BY wn.created_at DESC
    LIMIT 10
  `).all(userId, startDate, startDate, endDate, endDate);

  // 解析 JSON 字段
  const parsedWrongNotes = representativeWrongNotes.map(wn => ({
    ...wn,
    content: JSON.parse(wn.content),
    correct_answer: JSON.parse(wn.correct_answer),
    user_answer: JSON.parse(wn.user_answer),
    error_tags: wn.error_tags ? JSON.parse(wn.error_tags) : null
  }));

  // 找出薄弱知识点（正确率低于60%）
  const weakKnowledgePoints = byKnowledgePoint.filter(kp => kp.accuracy < 60 && kp.total_answers >= 3);

  return {
    overview,
    byKnowledgePoint,
    byQuestionType,
    errorTagCounts: errorTagCounts.map(etc => ({
      ...etc,
      label: ERROR_TAGS[etc.tag]?.label || etc.tag,
      description: ERROR_TAGS[etc.tag]?.description || ''
    })),
    representativeWrongNotes: parsedWrongNotes,
    weakKnowledgePoints
  };
};

// 获取报告数据（JSON格式）
router.get('/data',
  validate([
    query('userId').isInt(),
    query('startDate').optional().isString(),
    query('endDate').optional().isString()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId, startDate, endDate } = req.query;
      
      const reportData = await generateReportData(db, parseInt(userId), startDate, endDate);
      
      res.json({ data: reportData });
    } catch (error) {
      console.error('Error fetching report data:', error);
      res.status(500).json({ error: 'Failed to fetch report data' });
    }
  }
);

// 导出 Markdown 格式报告
router.get('/export/markdown',
  validate([
    query('userId').isInt(),
    query('startDate').optional().isString(),
    query('endDate').optional().isString()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId, startDate, endDate } = req.query;
      
      const reportData = await generateReportData(db, parseInt(userId), startDate, endDate);
      
      // 生成 Markdown 内容
      const markdown = generateMarkdownReport(reportData, startDate, endDate);
      
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=music-theory-report.md');
      res.send(markdown);
    } catch (error) {
      console.error('Error exporting markdown report:', error);
      res.status(500).json({ error: 'Failed to export markdown report' });
    }
  }
);

// 导出 HTML 格式报告
router.get('/export/html',
  validate([
    query('userId').isInt(),
    query('startDate').optional().isString(),
    query('endDate').optional().isString()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId, startDate, endDate } = req.query;
      
      const reportData = await generateReportData(db, parseInt(userId), startDate, endDate);
      
      // 生成 HTML 内容
      const html = generateHTMLReport(reportData, startDate, endDate);
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=music-theory-report.html');
      res.send(html);
    } catch (error) {
      console.error('Error exporting html report:', error);
      res.status(500).json({ error: 'Failed to export html report' });
    }
  }
);

// 导出 CSV 格式报告
router.get('/export/csv',
  validate([
    query('userId').isInt(),
    query('startDate').optional().isString(),
    query('endDate').optional().isString()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId, startDate, endDate } = req.query;
      
      const reportData = await generateReportData(db, parseInt(userId), startDate, endDate);
      
      // 生成 CSV 内容
      const csv = generateCSVReport(reportData, startDate, endDate);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=music-theory-report.csv');
      res.send('\uFEFF' + csv); // BOM for Excel compatibility
    } catch (error) {
      console.error('Error exporting csv report:', error);
      res.status(500).json({ error: 'Failed to export csv report' });
    }
  }
);

// 生成 Markdown 报告
const generateMarkdownReport = (data, startDate, endDate) => {
  const dateRange = startDate && endDate 
    ? `报告周期: ${startDate} 至 ${endDate}`
    : '报告周期: 全部历史数据';

  const typeDescriptions = {
    'scale_identification': '音阶音级识别',
    'chord_construction': '和弦构成',
    'inversion': '转位判断',
    'roman_numeral': '罗马数字和弦功能',
    'cadence': '终止式判断'
  };

  let md = `# 乐理和声练习报告\n\n`;
  md += `> ${dateRange}\n\n`;
  md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  
  md += `---\n\n`;
  
  // 概览
  md += `## 一、练习概览\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 练习会话数 | ${data.overview.total_sessions} |\n`;
  md += `| 总答题数 | ${data.overview.total_answers} |\n`;
  md += `| 答对题数 | ${data.overview.correct_answers} |\n`;
  md += `| 总体正确率 | ${data.overview.overall_accuracy}% |\n\n`;
  
  // 按知识点统计
  md += `## 二、知识点掌握情况\n\n`;
  if (data.byKnowledgePoint.length > 0) {
    md += `| 知识点 | 类别 | 答题数 | 正确率 |\n`;
    md += `|--------|------|--------|--------|\n`;
    data.byKnowledgePoint.forEach(kp => {
      md += `| ${kp.name} | ${kp.category} | ${kp.total_answers} | ${kp.accuracy}% |\n`;
    });
  } else {
    md += `暂无数据\n\n`;
  }
  md += `\n`;
  
  // 按题目类型统计
  md += `## 三、题型掌握情况\n\n`;
  if (data.byQuestionType.length > 0) {
    md += `| 题型 | 答题数 | 正确率 |\n`;
    md += `|------|--------|--------|\n`;
    data.byQuestionType.forEach(qt => {
      const typeName = typeDescriptions[qt.type] || qt.type;
      md += `| ${typeName} | ${qt.total_answers} | ${qt.accuracy}% |\n`;
    });
  } else {
    md += `暂无数据\n\n`;
  }
  md += `\n`;
  
  // 错因分布
  md += `## 四、错因分析\n\n`;
  if (data.errorTagCounts.length > 0) {
    md += `| 错因 | 次数 | 说明 |\n`;
    md += `|------|------|------|\n`;
    data.errorTagCounts.forEach(etc => {
      md += `| ${etc.label} | ${etc.count} | ${etc.description} |\n`;
    });
  } else {
    md += `暂无错题记录\n\n`;
  }
  md += `\n`;
  
  // 薄弱知识点
  md += `## 五、需要优先复习的知识点\n\n`;
  if (data.weakKnowledgePoints.length > 0) {
    data.weakKnowledgePoints.forEach((kp, index) => {
      md += `### ${index + 1}. ${kp.name}\n\n`;
      md += `- 类别: ${kp.category}\n`;
      md += `- 答题数: ${kp.total_answers}\n`;
      md += `- 正确率: ${kp.accuracy}%\n\n`;
    });
  } else {
    md += `表现良好，暂无需要特别关注的薄弱知识点。\n\n`;
  }
  
  // 代表性错题
  md += `## 六、代表性错题\n\n`;
  if (data.representativeWrongNotes.length > 0) {
    data.representativeWrongNotes.forEach((wn, index) => {
      const typeName = typeDescriptions[wn.type] || wn.type;
      md += `### 错题 ${index + 1}\n\n`;
      md += `- 题型: ${typeName}\n`;
      md += `- 难度: ${'★'.repeat(wn.difficulty)}\n`;
      md += `- 错因: ${wn.error_tags?.map(t => ERROR_TAGS[t]?.label || t).join(', ') || '未分析'}\n\n`;
      md += `**题目内容:**\n\`\`\`\n${JSON.stringify(wn.content, null, 2)}\n\`\`\`\n\n`;
      md += `**你的答案:**\n\`\`\`\n${JSON.stringify(wn.user_answer, null, 2)}\n\`\`\`\n\n`;
      md += `**正确答案:**\n\`\`\`\n${JSON.stringify(wn.correct_answer, null, 2)}\n\`\`\`\n\n`;
      if (wn.explanation) {
        md += `**解析:**\n${wn.explanation}\n\n`;
      }
      md += `---\n\n`;
    });
  } else {
    md += `暂无错题记录\n\n`;
  }
  
  md += `---\n\n`;
  md += `> 报告由乐理和声练习台自动生成\n`;
  
  return md;
};

// 生成 HTML 报告
const generateHTMLReport = (data, startDate, endDate) => {
  const dateRange = startDate && endDate 
    ? `报告周期: ${startDate} 至 ${endDate}`
    : '报告周期: 全部历史数据';

  const typeDescriptions = {
    'scale_identification': '音阶音级识别',
    'chord_construction': '和弦构成',
    'inversion': '转位判断',
    'roman_numeral': '罗马数字和弦功能',
    'cadence': '终止式判断'
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 80) return '#10b981';
    if (accuracy >= 60) return '#f59e0b';
    return '#ef4444';
  };

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>乐理和声练习报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
    h1 { color: #0ea5e9; border-bottom: 3px solid #0ea5e9; padding-bottom: 10px; }
    h2 { color: #0369a1; margin-top: 30px; border-left: 4px solid #0ea5e9; padding-left: 10px; }
    h3 { color: #075985; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
    th { background-color: #f1f5f9; font-weight: 600; }
    tr:hover { background-color: #f8fafc; }
    .accuracy-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 600; color: white; }
    .meta { color: #64748b; font-size: 0.9em; margin-bottom: 20px; }
    .wrong-note { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .code-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-family: monospace; overflow-x: auto; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 0.9em; text-align: center; }
  </style>
</head>
<body>
  <h1>🎵 乐理和声练习报告</h1>
  
  <div class="meta">
    <p>${dateRange}</p>
    <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  </div>

  <hr>

  <h2>一、练习概览</h2>
  <table>
    <tr><th>指标</th><th>数值</th></tr>
    <tr><td>练习会话数</td><td>${data.overview.total_sessions}</td></tr>
    <tr><td>总答题数</td><td>${data.overview.total_answers}</td></tr>
    <tr><td>答对题数</td><td>${data.overview.correct_answers}</td></tr>
    <tr><td>总体正确率</td><td><span class="accuracy-badge" style="background-color: ${getAccuracyColor(data.overview.overall_accuracy)}">${data.overview.overall_accuracy}%</span></td></tr>
  </table>

  <h2>二、知识点掌握情况</h2>
  ${data.byKnowledgePoint.length > 0 ? `
    <table>
      <tr><th>知识点</th><th>类别</th><th>答题数</th><th>正确率</th></tr>
      ${data.byKnowledgePoint.map(kp => `
        <tr>
          <td>${kp.name}</td>
          <td>${kp.category}</td>
          <td>${kp.total_answers}</td>
          <td><span class="accuracy-badge" style="background-color: ${getAccuracyColor(kp.accuracy)}">${kp.accuracy}%</span></td>
        </tr>
      `).join('')}
    </table>
  ` : '<p>暂无数据</p>'}

  <h2>三、题型掌握情况</h2>
  ${data.byQuestionType.length > 0 ? `
    <table>
      <tr><th>题型</th><th>答题数</th><th>正确率</th></tr>
      ${data.byQuestionType.map(qt => `
        <tr>
          <td>${typeDescriptions[qt.type] || qt.type}</td>
          <td>${qt.total_answers}</td>
          <td><span class="accuracy-badge" style="background-color: ${getAccuracyColor(qt.accuracy)}">${qt.accuracy}%</span></td>
        </tr>
      `).join('')}
    </table>
  ` : '<p>暂无数据</p>'}

  <h2>四、错因分析</h2>
  ${data.errorTagCounts.length > 0 ? `
    <table>
      <tr><th>错因</th><th>次数</th><th>说明</th></tr>
      ${data.errorTagCounts.map(etc => `
        <tr><td>${etc.label}</td><td>${etc.count}</td><td>${etc.description}</td></tr>
      `).join('')}
    </table>
  ` : '<p>暂无错题记录</p>'}

  <h2>五、需要优先复习的知识点</h2>
  ${data.weakKnowledgePoints.length > 0 ? data.weakKnowledgePoints.map((kp, index) => `
    <h3>${index + 1}. ${kp.name}</h3>
    <ul>
      <li>类别: ${kp.category}</li>
      <li>答题数: ${kp.total_answers}</li>
      <li>正确率: <span class="accuracy-badge" style="background-color: ${getAccuracyColor(kp.accuracy)}">${kp.accuracy}%</span></li>
    </ul>
  `).join('') : '<p>表现良好，暂无需要特别关注的薄弱知识点。</p>'}

  <h2>六、代表性错题</h2>
  ${data.representativeWrongNotes.length > 0 ? data.representativeWrongNotes.map((wn, index) => `
    <div class="wrong-note">
      <h3>错题 ${index + 1}</h3>
      <p><strong>题型:</strong> ${typeDescriptions[wn.type] || wn.type}</p>
      <p><strong>难度:</strong> ${'★'.repeat(wn.difficulty)}</p>
      <p><strong>错因:</strong> ${wn.error_tags?.map(t => ERROR_TAGS[t]?.label || t).join(', ') || '未分析'}</p>
      <p><strong>题目内容:</strong></p>
      <div class="code-block">${JSON.stringify(wn.content, null, 2)}</div>
      <p><strong>你的答案:</strong></p>
      <div class="code-block" style="border-color: #fca5a5;">${JSON.stringify(wn.user_answer, null, 2)}</div>
      <p><strong>正确答案:</strong></p>
      <div class="code-block" style="border-color: #86efac;">${JSON.stringify(wn.correct_answer, null, 2)}</div>
      ${wn.explanation ? `<p><strong>解析:</strong> ${wn.explanation}</p>` : ''}
    </div>
  `).join('') : '<p>暂无错题记录</p>'}

  <div class="footer">
    <p>报告由乐理和声练习台自动生成 | ${new Date().toLocaleDateString('zh-CN')}</p>
  </div>
</body>
</html>`;

  return html;
};

// 生成 CSV 报告
const generateCSVReport = (data, startDate, endDate) => {
  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '';
    str = String(str);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const typeDescriptions = {
    'scale_identification': '音阶音级识别',
    'chord_construction': '和弦构成',
    'inversion': '转位判断',
    'roman_numeral': '罗马数字和弦功能',
    'cadence': '终止式判断'
  };

  let csv = '';
  
  // 概览
  csv += '练习概览\n';
  csv += '指标,数值\n';
  csv += `练习会话数,${data.overview.total_sessions}\n`;
  csv += `总答题数,${data.overview.total_answers}\n`;
  csv += `答对题数,${data.overview.correct_answers}\n`;
  csv += `总体正确率,${data.overview.overall_accuracy}%\n\n`;
  
  // 知识点统计
  csv += '知识点掌握情况\n';
  csv += '知识点,类别,答题数,正确率\n';
  data.byKnowledgePoint.forEach(kp => {
    csv += `${escapeCSV(kp.name)},${escapeCSV(kp.category)},${kp.total_answers},${kp.accuracy}%\n`;
  });
  csv += '\n';
  
  // 题型统计
  csv += '题型掌握情况\n';
  csv += '题型,答题数,正确率\n';
  data.byQuestionType.forEach(qt => {
    const typeName = typeDescriptions[qt.type] || qt.type;
    csv += `${escapeCSV(typeName)},${qt.total_answers},${qt.accuracy}%\n`;
  });
  csv += '\n';
  
  // 错因分布
  csv += '错因分析\n';
  csv += '错因,次数,说明\n';
  data.errorTagCounts.forEach(etc => {
    csv += `${escapeCSV(etc.label)},${etc.count},${escapeCSV(etc.description)}\n`;
  });
  csv += '\n';
  
  // 薄弱知识点
  csv += '需要优先复习的知识点\n';
  csv += '序号,知识点,类别,答题数,正确率\n';
  data.weakKnowledgePoints.forEach((kp, index) => {
    csv += `${index + 1},${escapeCSV(kp.name)},${escapeCSV(kp.category)},${kp.total_answers},${kp.accuracy}%\n`;
  });
  csv += '\n';
  
  // 代表性错题
  csv += '代表性错题\n';
  csv += '序号,题型,难度,错因,题目内容,你的答案,正确答案,解析\n';
  data.representativeWrongNotes.forEach((wn, index) => {
    const typeName = typeDescriptions[wn.type] || wn.type;
    const errorTags = wn.error_tags?.map(t => ERROR_TAGS[t]?.label || t).join('; ') || '';
    csv += `${index + 1},${escapeCSV(typeName)},${'★'.repeat(wn.difficulty)},${escapeCSV(errorTags)},${escapeCSV(JSON.stringify(wn.content))},${escapeCSV(JSON.stringify(wn.user_answer))},${escapeCSV(JSON.stringify(wn.correct_answer))},${escapeCSV(wn.explanation || '')}\n`;
  });

  return csv;
};

export default router;
