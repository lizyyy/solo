const express = require('express');
const multer = require('multer');
const dayjs = require('dayjs');
const path = require('path');
const { parseSensorCSV, parseVentilationCSV, parseCourseCSV, parseCleaningCSV, THRESHOLDS } = require('./csvParser');
const { assessAllCoursesForDate, getDailyTimeline, getAvailableRooms, updateManualOverride } = require('./calculator');
const { allQuery, runQuery, getQuery } = require('./database');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/rooms', async (req, res) => {
  try {
    const rooms = await getAvailableRooms();
    res.json({ rooms: rooms.length > 0 ? rooms : ['默认教室'] });
  } catch (err) {
    console.error('获取教室列表失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/sensor', upload.single('file'), async (req, res) => {
  try {
    const room = req.body.room || '默认教室';
    const fs = require('fs');
    const content = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path);
    
    const result = await parseSensorCSV(content, room);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('导入传感器数据失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/ventilation', upload.single('file'), async (req, res) => {
  try {
    const room = req.body.room || '默认教室';
    const fs = require('fs');
    const content = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path);
    
    const result = await parseVentilationCSV(content, room);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('导入通风记录失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/course', upload.single('file'), async (req, res) => {
  try {
    const room = req.body.room || '默认教室';
    const fs = require('fs');
    const content = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path);
    
    const result = await parseCourseCSV(content, room);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('导入课程预约失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/cleaning', upload.single('file'), async (req, res) => {
  try {
    const room = req.body.room || '默认教室';
    const fs = require('fs');
    const content = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path);
    
    const result = await parseCleaningCSV(content, room);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('导入清洁消毒记录失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/timeline', async (req, res) => {
  try {
    const room = req.query.room || '默认教室';
    const date = req.query.date || dayjs().format('YYYY-MM-DD');
    
    const timeline = await getDailyTimeline(room, date);
    res.json(timeline);
  } catch (err) {
    console.error('获取时间线失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/assess', async (req, res) => {
  try {
    const room = req.body.room || '默认教室';
    const date = req.body.date || dayjs().format('YYYY-MM-DD');
    
    const assessments = await assessAllCoursesForDate(room, date);
    res.json({ assessments });
  } catch (err) {
    console.error('评估失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/assessment/:id/override', async (req, res) => {
  try {
    const { id } = req.params;
    const { can_proceed, override_reason, notes } = req.body;
    
    await updateManualOverride(id, can_proceed, override_reason, notes);
    
    const updated = await getQuery(`SELECT * FROM risk_assessments WHERE id = ?`, [id]);
    res.json({ success: true, assessment: updated });
  } catch (err) {
    console.error('更新人工改判失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/json', async (req, res) => {
  try {
    const room = req.query.room || '默认教室';
    const date = req.query.date || dayjs().format('YYYY-MM-DD');
    
    const timeline = await getDailyTimeline(room, date);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=air-quality-${room}-${date}.json`);
    res.json(timeline);
  } catch (err) {
    console.error('导出JSON失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/markdown', async (req, res) => {
  try {
    const room = req.query.room || '默认教室';
    const date = req.query.date || dayjs().format('YYYY-MM-DD');
    
    const timeline = await getDailyTimeline(room, date);
    const markdown = generateMarkdownReport(room, date, timeline);
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=air-quality-${room}-${date}.md`);
    res.send(markdown);
  } catch (err) {
    console.error('导出Markdown失败:', err);
    res.status(500).json({ error: err.message });
  }
});

function generateMarkdownReport(room, date, timeline) {
  const { sensorData, courses, cleaningRecords, ventilationData, assessments, thresholds } = timeline;
  
  const getRiskBadge = (level) => {
    switch(level) {
      case 'danger': return '🔴 危险';
      case 'warning': return '🟡 警告';
      default: return '🟢 安全';
    }
  };
  
  const getStatusBadge = (canProceed, manualOverride) => {
    if (manualOverride) {
      return canProceed ? '✅ 人工放行' : '❌ 人工拒绝';
    }
    return canProceed ? '✅ 自动放行' : '❌ 自动拒绝';
  };

  let md = `# 室内儿童活动室空气质量放行单

**教室**: ${room}  
**日期**: ${date}  
**生成时间**: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}

---

## 风险阈值说明

| 指标 | 警告阈值 | 危险阈值 | 单位 |
|------|---------|---------|------|
| CO₂ | ${thresholds.co2.warning} | ${thresholds.co2.danger} | ppm |
| PM2.5 | ${thresholds.pm25.warning} | ${thresholds.pm25.danger} | μg/m³ |
| TVOC | ${thresholds.tvoc.warning} | ${thresholds.tvoc.danger} | mg/m³ |

---

## 课程放行评估

`;

  if (courses.length === 0) {
    md += `*本日无课程预约*\n\n`;
  } else {
    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];
      const assessment = assessments.find(a => a.course_id === course.id);
      
      md += `### ${i + 1}. ${course.course_name}

**时间**: ${dayjs(course.start_time).format('HH:mm')} - ${dayjs(course.end_time).format('HH:mm')}  
`;
      if (course.teacher) md += `**教师**: ${course.teacher}  \n`;
      if (course.students_count) md += `**学生人数**: ${course.students_count}  \n`;

      if (assessment) {
        md += `
**风险等级**: ${getRiskBadge(assessment.risk_level)}  
**放行状态**: ${getStatusBadge(assessment.can_proceed, assessment.manual_override)}  

`;
        if (assessment.co2_level !== null) {
          md += `**当前CO₂**: ${assessment.co2_level} ppm  \n`;
        }
        if (assessment.pm25_level !== null) {
          md += `**当前PM2.5**: ${assessment.pm25_level} μg/m³  \n`;
        }
        if (assessment.tvoc_level !== null) {
          md += `**当前TVOC**: ${assessment.tvoc_level} mg/m³  \n`;
        }
        if (assessment.ventilation_recovery_minutes !== null) {
          md += `**预估通风恢复时间**: ${assessment.ventilation_recovery_minutes} 分钟  \n`;
        }
        
        if (assessment.risk_reasons) {
          md += `\n**风险原因**: ${assessment.risk_reasons}  \n`;
        }
        
        if (assessment.manual_override) {
          md += `\n**人工改判原因**: ${assessment.override_reason || '无'}  \n`;
        }
        if (assessment.notes) {
          md += `**备注**: ${assessment.notes}  \n`;
        }
      } else {
        md += `\n*暂无评估数据*\n`;
      }
      md += `\n---\n\n`;
    }
  }

  md += `## 传感器数据概览

`;
  if (sensorData.length === 0) {
    md += `*本日无传感器数据*\n\n`;
  } else {
    const validCo2 = sensorData.filter(d => d.co2 !== null).map(d => d.co2);
    const validPm25 = sensorData.filter(d => d.pm25 !== null).map(d => d.pm25);
    const validTvoc = sensorData.filter(d => d.tvoc !== null).map(d => d.tvoc);
    
    if (validCo2.length > 0) {
      md += `**CO₂**: 范围 ${Math.min(...validCo2).toFixed(0)} - ${Math.max(...validCo2).toFixed(0)} ppm (共 ${validCo2.length} 条记录)  \n`;
    }
    if (validPm25.length > 0) {
      md += `**PM2.5**: 范围 ${Math.min(...validPm25).toFixed(1)} - ${Math.max(...validPm25).toFixed(1)} μg/m³ (共 ${validPm25.length} 条记录)  \n`;
    }
    if (validTvoc.length > 0) {
      md += `**TVOC**: 范围 ${Math.min(...validTvoc).toFixed(2)} - ${Math.max(...validTvoc).toFixed(2)} mg/m³ (共 ${validTvoc.length} 条记录)  \n`;
    }
  }

  md += `\n---\n\n## 通风记录

`;
  if (ventilationData.length === 0) {
    md += `*本日无通风记录*\n\n`;
  } else {
    md += `| 类型 | 开始时间 | 结束时间 | 状态 |\n|------|---------|---------|------|\n`;
    for (const vent of ventilationData) {
      const typeDisplay = vent.type === 'window' ? '开窗' : '新风';
      const statusDisplay = vent.status === 'active' ? '进行中' : '已完成';
      const endTime = vent.end_time ? dayjs(vent.end_time).format('HH:mm') : '-';
      md += `| ${typeDisplay} | ${dayjs(vent.start_time).format('HH:mm')} | ${endTime} | ${statusDisplay} |\n`;
    }
  }

  md += `\n---\n\n## 清洁消毒记录

`;
  if (cleaningRecords.length === 0) {
    md += `*本日无清洁消毒记录*\n\n`;
  } else {
    md += `| 类型 | 时间 | 操作人员 | 备注 |\n|------|------|---------|------|\n`;
    for (const record of cleaningRecords) {
      const typeDisplay = record.type === 'cleaning' ? '清洁' : '消毒';
      const staff = record.staff || '-';
      const notes = record.notes || '-';
      md += `| ${typeDisplay} | ${dayjs(record.timestamp).format('HH:mm')} | ${staff} | ${notes} |\n`;
    }
  }

  md += `\n---\n\n*本报告由空气质量放行系统自动生成，如有疑问请联系管理员。*\n`;

  return md;
}

router.get('/thresholds', (req, res) => {
  res.json({ thresholds: THRESHOLDS });
});

router.delete('/clear/:room', async (req, res) => {
  try {
    const room = req.params.room;
    await runQuery(`DELETE FROM sensor_data WHERE room = ?`, [room]);
    await runQuery(`DELETE FROM ventilation_records WHERE room = ?`, [room]);
    await runQuery(`DELETE FROM course_bookings WHERE room = ?`, [room]);
    await runQuery(`DELETE FROM cleaning_records WHERE room = ?`, [room]);
    await runQuery(`DELETE FROM risk_assessments WHERE room = ?`, [room]);
    
    res.json({ success: true, message: `已清空教室 "${room}" 的所有数据` });
  } catch (err) {
    console.error('清空数据失败:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;