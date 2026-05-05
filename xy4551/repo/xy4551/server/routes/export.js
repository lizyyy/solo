const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');

function loadStoredData() {
  const filePath = path.join(dataDir, 'stored-data.json');
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }
  return {
    surgerySchedule: [],
    postOpCages: [],
    oxygenLogs: [],
    anesthesiaRecovery: [],
    ownerNotes: [],
    overrides: {},
    additionalNotes: {}
  };
}

router.get('/json', (req, res) => {
  try {
    const data = loadStoredData();
    const exportData = {
      exportTime: new Date().toISOString(),
      data: {
        surgerySchedule: data.surgerySchedule,
        postOpCages: data.postOpCages,
        oxygenLogs: data.oxygenLogs,
        anesthesiaRecovery: data.anesthesiaRecovery,
        ownerNotes: data.ownerNotes
      },
      annotations: {
        overrides: data.overrides,
        additionalNotes: data.additionalNotes
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=pet-clinic-export-${Date.now()}.json`);
    res.send(JSON.stringify(exportData, null, 2));

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/markdown', (req, res) => {
  try {
    const data = loadStoredData();
    const markdown = generateMarkdownReport(data);
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=交班单-${new Date().toISOString().slice(0, 10)}.md`);
    res.send(markdown);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function generateMarkdownReport(data) {
  const {
    surgerySchedule = [],
    postOpCages = [],
    oxygenLogs = [],
    anesthesiaRecovery = [],
    ownerNotes = [],
    overrides = {},
    additionalNotes = {}
  } = data;

  const now = new Date();
  const reportDate = now.toLocaleDateString('zh-CN');
  const reportTime = now.toLocaleTimeString('zh-CN');

  let markdown = `# 🐾 宠物医院夜班交班单

> 生成时间：${reportDate} ${reportTime}

---

## 📋 手术排班

`;

  if (surgerySchedule.length === 0) {
    markdown += `> 暂无手术安排\n\n`;
  } else {
    markdown += `| 宠物名 | 手术类型 | 预约时间 | 主刀医生 | 备注 |\n`;
    markdown += `|--------|----------|----------|----------|------|\n`;
    
    surgerySchedule.forEach(surgery => {
      const patientName = surgery.patientName || surgery.patient_name || surgery.宠物名 || '-';
      const surgeryType = surgery.surgeryType || surgery.surgery_type || surgery.手术类型 || '-';
      const scheduledTime = surgery.scheduledTime || surgery.scheduled_time || surgery.预约时间 || '-';
      const surgeon = surgery.surgeon || surgery.主刀医生 || '-';
      const notes = surgery.notes || surgery.备注 || '-';
      
      markdown += `| ${patientName} | ${surgeryType} | ${scheduledTime} | ${surgeon} | ${notes} |\n`;
    });
    markdown += `\n`;
  }

  markdown += `---

## 🏥 术后笼位安排

`;

  if (postOpCages.length === 0) {
    markdown += `> 暂无术后笼位安排\n\n`;
  } else {
    markdown += `| 笼位号 | 宠物名 | 入住时间 | 预计离开 | 状态 | 特殊需求 |\n`;
    markdown += `|--------|--------|----------|----------|------|----------|\n`;
    
    postOpCages.forEach(cage => {
      const cageNumber = cage.cageNumber || cage.cage_number || cage.笼位号 || '-';
      const patientName = cage.patientName || cage.patient_name || cage.宠物名 || '-';
      const startTime = cage.startTime || cage.start_time || cage.开始时间 || cage.入住时间 || '-';
      const endTime = cage.endTime || cage.end_time || cage.预计离开时间 || '-';
      const status = cage.status || cage.状态 || '住院中';
      const specialNeeds = cage.specialNeeds || cage.special_needs || cage.特殊需求 || '-';
      
      markdown += `| ${cageNumber} | ${patientName} | ${startTime} | ${endTime} | ${status} | ${specialNeeds} |\n`;
    });
    markdown += `\n`;
  }

  markdown += `---

## 💨 氧气流量日志

`;

  if (oxygenLogs.length === 0) {
    markdown += `> 暂无氧气流量记录\n\n`;
  } else {
    markdown += `| 时间 | 宠物名 | 流量 (L/min) | 状态 | 操作人 | 备注 |\n`;
    markdown += `|------|--------|---------------|------|--------|------|\n`;
    
    oxygenLogs.forEach(log => {
      const timestamp = log.timestamp || log.time || log.时间 || '-';
      const patientName = log.patientName || log.patient_name || log.宠物名 || '-';
      const flowRate = log.flowRate || log.flow_rate || log.流量 || '0';
      const status = log.status || log.状态 || '-';
      const operator = log.operator || log.操作人 || '-';
      const notes = log.notes || log.备注 || '-';
      
      markdown += `| ${timestamp} | ${patientName} | ${flowRate} | ${status} | ${operator} | ${notes} |\n`;
    });
    markdown += `\n`;
  }

  markdown += `---

## 💤 麻醉苏醒记录

`;

  if (anesthesiaRecovery.length === 0) {
    markdown += `> 暂无麻醉苏醒记录\n\n`;
  } else {
    markdown += `| 宠物名 | 手术结束时间 | 拔管时间 | 完全苏醒时间 | 当前状态 | 苏醒评分 | 备注 |\n`;
    markdown += `|--------|--------------|----------|--------------|----------|----------|------|\n`;
    
    anesthesiaRecovery.forEach(recovery => {
      const patientName = recovery.patientName || recovery.patient_name || recovery.宠物名 || '-';
      const surgeryEndTime = recovery.surgeryEndTime || recovery.surgery_end_time || recovery.手术结束时间 || '-';
      const extubationTime = recovery.extubationTime || recovery.extubation_time || recovery.拔管时间 || '-';
      const fullRecoveryTime = recovery.fullRecoveryTime || recovery.full_recovery_time || recovery.完全苏醒时间 || '-';
      const status = recovery.status || recovery.状态 || '恢复中';
      const score = recovery.recoveryScore || recovery.recovery_score || recovery.苏醒评分 || '-';
      const notes = recovery.notes || recovery.备注 || '-';
      
      markdown += `| ${patientName} | ${surgeryEndTime} | ${extubationTime} | ${fullRecoveryTime} | ${status} | ${score} | ${notes} |\n`;
    });
    markdown += `\n`;
  }

  markdown += `---

## 👤 主人接送备注

`;

  if (ownerNotes.length === 0) {
    markdown += `> 暂无主人接送备注\n\n`;
  } else {
    markdown += `| 宠物名 | 主人姓名 | 联系电话 | 接送时间 | 交接内容 | 特殊说明 |\n`;
    markdown += `|--------|----------|----------|----------|----------|----------|\n`;
    
    ownerNotes.forEach(note => {
      const patientName = note.patientName || note.patient_name || note.宠物名 || '-';
      const ownerName = note.ownerName || note.owner_name || note.主人姓名 || '-';
      const phone = note.phone || note.联系电话 || '-';
      const pickupTime = note.pickupTime || note.pickup_time || note.接送时间 || '-';
      const handoverContent = note.handoverContent || note.handover_content || note.交接内容 || '-';
      const specialNotes = note.specialNotes || note.special_notes || note.特殊说明 || '-';
      
      markdown += `| ${patientName} | ${ownerName} | ${phone} | ${pickupTime} | ${handoverContent} | ${specialNotes} |\n`;
    });
    markdown += `\n`;
  }

  const additionalNotesList = Object.entries(additionalNotes || {});
  if (additionalNotesList.length > 0) {
    markdown += `---

## 📝 补充备注

`;
    additionalNotesList.forEach(([key, noteData]) => {
      const [recordType, recordId] = key.split(':');
      const typeLabel = {
        'surgery': '手术',
        'cage': '笼位',
        'oxygen': '氧气',
        'recovery': '苏醒',
        'owner': '主人'
      }[recordType] || recordType;
      
      markdown += `### ${typeLabel}备注 (ID: ${recordId.substring(0, 8)}...)\n`;
      markdown += `> 添加时间：${noteData.createdAt || '-'}\n\n`;
      markdown += `${noteData.note || '-'}\n\n`;
    });
  }

  const activeOverrides = Object.entries(overrides || {}).filter(([_, o]) => o);
  if (activeOverrides.length > 0) {
    markdown += `---

## ⚠️ 风险人工改判记录

`;
    activeOverrides.forEach(([riskId, override]) => {
      const statusLabel = {
        'dismissed': '已忽略',
        'confirmed': '已确认',
        'resolved': '已解决'
      }[override.status] || override.status;
      
      markdown += `- **风险ID**: ${riskId}\n`;
      markdown += `  - **改判状态**: ${statusLabel}\n`;
      markdown += `  - **改判时间**: ${override.updatedAt || override.createdAt || '-'}\n`;
      if (override.overrideNote) {
        markdown += `  - **改判说明**: ${override.overrideNote}\n`;
      }
      markdown += `\n`;
    });
  }

  markdown += `---

## 🔗 交班确认

| 项目 | 状态 |
|------|------|
| 手术排班核对 | ☐ 已核对 |
| 笼位安排确认 | ☐ 已确认 |
| 氧气流量检查 | ☐ 已检查 |
| 麻醉苏醒监测 | ☐ 已监测 |
| 主人交接备注 | ☐ 已交接 |

---

**交班护士**: _______________ 

**接班护士**: _______________ 

**交班时间**: _______________

---

*本报告由宠物医院夜班护士工具自动生成*
`;

  return markdown;
}

module.exports = router;
