const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DATA_FILE = path.join(DATA_DIR, 'chorus-data.json');

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error loading data:', e);
    }
  }
  return {
    program: [],
    scoreLoans: [],
    authorizations: [],
    attendance: [],
    overrideDecisions: {},
    notes: {}
  };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving data:', e);
    return false;
  }
}

function parseCSV(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8'
  });
  if (result.errors.length > 0) {
    console.error('CSV parse errors:', result.errors);
  }
  return result.data;
}

function calculateRisks(data) {
  const risks = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { program, scoreLoans, authorizations, attendance, overrideDecisions, notes } = data;

  const programByTitle = {};
  program.forEach(p => {
    if (!programByTitle[p.title]) {
      programByTitle[p.title] = [];
    }
    programByTitle[p.title].push(p);
  });

  const scoreLoansByTitle = {};
  scoreLoans.forEach(loan => {
    if (!scoreLoansByTitle[loan.title]) {
      scoreLoansByTitle[loan.title] = [];
    }
    scoreLoansByTitle[loan.title].push(loan);
  });

  const authsByTitle = {};
  authorizations.forEach(auth => {
    if (!authsByTitle[auth.title]) {
      authsByTitle[auth.title] = [];
    }
    authsByTitle[auth.title].push(auth);
  });

  const attendanceByTitleVoice = {};
  attendance.forEach(att => {
    const key = `${att.title}-${att.voice}`;
    if (!attendanceByTitleVoice[key]) {
      attendanceByTitleVoice[key] = [];
    }
    attendanceByTitleVoice[key].push(att);
  });

  program.forEach(p => {
    const title = p.title;
    const id = `p-${p.index || p.title}-${p.voice || 'all'}`;

    const override = overrideDecisions[id];
    const note = notes[id];

    const programVoices = p.voices ? p.voices.split(/[,，]/).map(v => v.trim()) : 
                          p.voice ? [p.voice] : ['S', 'A', 'T', 'B'];
    
    const loans = scoreLoansByTitle[title] || [];
    const authList = authsByTitle[title] || [];

    const programRisk = {
      id,
      title,
      conductor: p.conductor || '',
      voices: programVoices,
      performanceDate: p.performanceDate || '',
      index: p.index || 0,
      risks: [],
      override,
      note,
      finalDecision: 'pending'
    };

    if (loans.length === 0) {
      programRisk.risks.push({
        type: 'missing_score',
        severity: 'high',
        message: '无曲谱借出记录，需要确认谱子是否已分发或库存充足',
        details: { title }
      });
    } else {
      programVoices.forEach(voice => {
        const voiceLoans = loans.filter(l => l.voice === voice);
        if (voiceLoans.length === 0) {
          programRisk.risks.push({
            type: 'missing_voice_score',
            severity: 'medium',
            message: `${voice}声部无曲谱借出记录`,
            details: { title, voice }
          });
        }
      });

      const borrowerGroups = {};
      loans.forEach(loan => {
        const key = `${loan.borrower}-${loan.voice}`;
        if (!borrowerGroups[key]) {
          borrowerGroups[key] = [];
        }
        borrowerGroups[key].push(loan);
      });

      Object.keys(borrowerGroups).forEach(key => {
        if (borrowerGroups[key].length > 1) {
          const [borrower, voice] = key.split('-');
          programRisk.risks.push({
            type: 'multiple_loans_same_person',
            severity: 'medium',
            message: `${borrower}(${voice}声部)借出了${borrowerGroups[key].length}份相同曲目谱子`,
            details: { title, borrower, voice, count: borrowerGroups[key].length }
          });
        }
      });
    }

    if (authList.length === 0) {
      programRisk.risks.push({
        type: 'no_authorization',
        severity: 'high',
        message: '无演出授权记录，需要确认是否已获得版权授权',
        details: { title }
      });
    } else {
      authList.forEach(auth => {
        if (auth.expiryDate) {
          const expiryDate = parseDate(auth.expiryDate);
          if (expiryDate && expiryDate < today) {
            programRisk.risks.push({
              type: 'authorization_expired',
              severity: 'high',
              message: `演出授权已过期（到期日：${auth.expiryDate}）`,
              details: { title, expiryDate: auth.expiryDate }
            });
          }
        }
      });
    }

    programVoices.forEach(voice => {
      const attKey = `${title}-${voice}`;
      const voiceAttendance = attendanceByTitleVoice[attKey] || [];
      
      const attendedCount = voiceAttendance.filter(att => 
        att.status === '出席' || att.status === '是' || att.status === '1' || 
        (att.attended && att.attended !== '0' && att.attended !== '否')
      ).length;

      if (voiceAttendance.length === 0) {
        programRisk.risks.push({
          type: 'no_attendance_record',
          severity: 'medium',
          message: `${voice}声部无排练签到记录`,
          details: { title, voice }
        });
      } else if (attendedCount < voiceAttendance.length * 0.5) {
        programRisk.risks.push({
          type: 'low_attendance',
          severity: 'medium',
          message: `${voice}声部出勤率不足50%（${attendedCount}/${voiceAttendance.length}人出席）`,
          details: { title, voice, attended: attendedCount, total: voiceAttendance.length }
        });
      }
    });

    if (programRisk.risks.length === 0) {
      programRisk.finalDecision = 'approved';
    } else {
      const hasHighRisk = programRisk.risks.some(r => r.severity === 'high');
      programRisk.finalDecision = hasHighRisk ? 'blocked' : 'warning';
    }

    if (override) {
      programRisk.finalDecision = override;
    }

    risks.push(programRisk);
  });

  const overdueLoans = scoreLoans.filter(loan => {
    if (!loan.dueDate) return false;
    const dueDate = parseDate(loan.dueDate);
    return dueDate && dueDate < today;
  });

  const overdueRisks = overdueLoans.map(loan => ({
    id: `loan-${loan.title}-${loan.voice}-${loan.borrower}`,
    title: loan.title,
    borrower: loan.borrower,
    voice: loan.voice,
    dueDate: loan.dueDate,
    loanDate: loan.loanDate,
    risks: [{
      type: 'loan_overdue',
      severity: 'medium',
      message: `${loan.borrower}(${loan.voice}声部)的谱子已超期（应还日期：${loan.dueDate}）`,
      details: loan
    }],
    finalDecision: 'warning',
    override: overrideDecisions[`loan-${loan.title}-${loan.voice}-${loan.borrower}`],
    note: notes[`loan-${loan.title}-${loan.voice}-${loan.borrower}`]
  }));

  return {
    programRisks: risks,
    overdueLoans: overdueRisks,
    summary: {
      totalPrograms: program.length,
      highRiskCount: risks.filter(r => r.finalDecision === 'blocked').length,
      mediumRiskCount: risks.filter(r => r.finalDecision === 'warning').length,
      approvedCount: risks.filter(r => r.finalDecision === 'approved').length,
      overdueCount: overdueLoans.length
    }
  };
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const formats = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year, month, day;
      if (match[1].length === 4) {
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      } else {
        year = parseInt(match[3]);
        month = parseInt(match[1]) - 1;
        day = parseInt(match[2]);
      }
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  return null;
}

function exportMarkdown(data, riskAnalysis) {
  const { programRisks, summary } = riskAnalysis;
  
  let md = '# 合唱团演出授权预检交接单\n\n';
  md += `生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
  md += '## 风险汇总\n\n';
  md += `| 指标 | 数量 |\n|------|------|\n`;
  md += `| 总节目数 | ${summary.totalPrograms} |\n`;
  md += `| 高风险（需关注） | ${summary.highRiskCount} |\n`;
  md += `| 中风险（需注意） | ${summary.mediumRisk} |\n`;
  md += `| 通过 | ${summary.approvedCount} |\n`;
  md += `| 超期待追回谱子 | ${summary.overdueCount} |\n\n`;

  md += '## 节目详情\n\n';
  
  programRisks.sort((a, b) => {
    const order = { blocked: 0, warning: 1, pending: 2, approved: 3 };
    return (order[a.finalDecision] || 0) - (order[b.finalDecision] || 0);
  });

  programRisks.forEach(program => {
    const statusEmoji = {
      blocked: '🔴',
      warning: '🟡',
      approved: '🟢',
      pending: '⚪'
    }[program.finalDecision] || '⚪';

    const statusText = {
      blocked: '高风险',
      warning: '中风险',
      approved: '通过',
      pending: '待确认'
    }[program.finalDecision] || '待确认';

    md += `### ${program.title} ${statusEmoji} ${statusText}\n\n`;
    
    if (program.conductor) md += `- **指挥**：${program.conductor}\n`;
    if (program.voices && program.voices.length > 0) {
      md += `- **声部**：${program.voices.join('、')}\n`;
    }
    if (program.performanceDate) md += `- **演出日期**：${program.performanceDate}\n`;
    if (program.override) {
      const overrideText = {
        blocked: '人工判定：不通过',
        warning: '人工判定：需关注',
        approved: '人工判定：通过'
      }[program.override] || `人工判定：${program.override}`;
      md += `- **${overrideText}**\n`;
    }

    if (program.risks.length > 0) {
      md += '\n**风险提示**：\n\n';
      program.risks.forEach((risk, idx) => {
        const sevEmoji = risk.severity === 'high' ? '🔴' : '🟡';
        md += `${idx + 1}. ${sevEmoji} ${risk.message}\n`;
      });
    }

    if (program.note) {
      md += `\n**备注**：${program.note}\n`;
    }

    md += '\n---\n\n';
  });

  if (riskAnalysis.overdueLoans && riskAnalysis.overdueLoans.length > 0) {
    md += '## 超期待追回谱子\n\n';
    riskAnalysis.overdueLoans.forEach(loan => {
      md += `- **曲目**：${loan.title}\n`;
      md += `  - **借阅人**：${loan.borrower}（${loan.voice}声部）\n`;
      md += `  - **借出日期**：${loan.loanDate || '未知'}\n`;
      md += `  - **应还日期**：${loan.dueDate}\n`;
      if (loan.note) md += `  - **备注**：${loan.note}\n`;
      md += '\n';
    });
  }

  return md;
}

app.get('/api/data', (req, res) => {
  const data = loadData();
  const riskAnalysis = calculateRisks(data);
  res.json({
    success: true,
    data,
    riskAnalysis
  });
});

app.post('/api/import/program', (req, res) => {
  try {
    const { content, format } = req.body;
    let parsedData;
    
    if (format === 'csv') {
      parsedData = parseCSV(content);
    } else if (format === 'json') {
      parsedData = JSON.parse(content);
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }
    } else {
      return res.status(400).json({ success: false, message: '不支持的格式' });
    }

    const data = loadData();
    data.program = parsedData.map((item, idx) => ({
      ...item,
      index: item.index || item.idx || idx + 1
    }));
    
    saveData(data);
    const riskAnalysis = calculateRisks(data);
    
    res.json({
      success: true,
      message: `成功导入 ${parsedData.length} 个节目`,
      data,
      riskAnalysis
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/import/score-loans', (req, res) => {
  try {
    const { content, format } = req.body;
    let parsedData;
    
    if (format === 'csv') {
      parsedData = parseCSV(content);
    } else if (format === 'json') {
      parsedData = JSON.parse(content);
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }
    } else {
      return res.status(400).json({ success: false, message: '不支持的格式' });
    }

    const data = loadData();
    data.scoreLoans = parsedData;
    saveData(data);
    const riskAnalysis = calculateRisks(data);
    
    res.json({
      success: true,
      message: `成功导入 ${parsedData.length} 条曲谱借出记录`,
      data,
      riskAnalysis
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/import/authorizations', (req, res) => {
  try {
    const { content, format } = req.body;
    let parsedData;
    
    if (format === 'csv') {
      parsedData = parseCSV(content);
    } else if (format === 'json') {
      parsedData = JSON.parse(content);
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }
    } else {
      return res.status(400).json({ success: false, message: '不支持的格式' });
    }

    const data = loadData();
    data.authorizations = parsedData;
    saveData(data);
    const riskAnalysis = calculateRisks(data);
    
    res.json({
      success: true,
      message: `成功导入 ${parsedData.length} 条授权记录`,
      data,
      riskAnalysis
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/import/attendance', (req, res) => {
  try {
    const { content, format } = req.body;
    let parsedData;
    
    if (format === 'csv') {
      parsedData = parseCSV(content);
    } else if (format === 'json') {
      parsedData = JSON.parse(content);
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }
    } else {
      return res.status(400).json({ success: false, message: '不支持的格式' });
    }

    const data = loadData();
    data.attendance = parsedData;
    saveData(data);
    const riskAnalysis = calculateRisks(data);
    
    res.json({
      success: true,
      message: `成功导入 ${parsedData.length} 条签到记录`,
      data,
      riskAnalysis
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/override', (req, res) => {
  try {
    const { id, decision } = req.body;
    const data = loadData();
    
    if (decision) {
      data.overrideDecisions[id] = decision;
    } else {
      delete data.overrideDecisions[id];
    }
    
    saveData(data);
    const riskAnalysis = calculateRisks(data);
    
    res.json({
      success: true,
      data,
      riskAnalysis
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/note', (req, res) => {
  try {
    const { id, note } = req.body;
    const data = loadData();
    
    if (note) {
      data.notes[id] = note;
    } else {
      delete data.notes[id];
    }
    
    saveData(data);
    const riskAnalysis = calculateRisks(data);
    
    res.json({
      success: true,
      data,
      riskAnalysis
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/export/markdown', (req, res) => {
  const data = loadData();
  const riskAnalysis = calculateRisks(data);
  const markdown = exportMarkdown(data, riskAnalysis);
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=演出授权交接单-${new Date().toISOString().split('T')[0]}.md`);
  res.send(markdown);
});

app.get('/api/export/json', (req, res) => {
  const data = loadData();
  const riskAnalysis = calculateRisks(data);
  
  const exportData = {
    exportTime: new Date().toISOString(),
    rawData: data,
    riskAnalysis
  };
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=演出预检数据-${new Date().toISOString().split('T')[0]}.json`);
  res.send(JSON.stringify(exportData, null, 2));
});

app.post('/api/reset', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      fs.unlinkSync(DATA_FILE);
    }
    const data = loadData();
    const riskAnalysis = calculateRisks(data);
    
    res.json({
      success: true,
      message: '数据已重置',
      data,
      riskAnalysis
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`合唱团曲谱预检工具已启动: http://localhost:${PORT}`);
});
