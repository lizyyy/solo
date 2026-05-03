const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

export const exportMarkdown = (caseData) => {
  const lines = [];
  
  lines.push(`# 麻醉监护复盘报告`);
  lines.push('');
  
  lines.push(`## 病例基本信息`);
  lines.push('');
  lines.push(`| 项目 | 内容 |`);
  lines.push(`|------|------|`);
  lines.push(`| 病例ID | ${caseData.id || caseData.caseId || '-'} |`);
  lines.push(`| 动物名称 | ${caseData.patientName || caseData.patient || '-'} |`);
  lines.push(`| 动物类型 | ${caseData.species || caseData.animalType || '-'} |`);
  lines.push(`| 年龄 | ${caseData.age || '-'} |`);
  lines.push(`| 体重 | ${caseData.weight || '-'} kg |`);
  lines.push(`| 手术类型 | ${caseData.procedure || caseData.surgeryType || '-'} |`);
  lines.push(`| 手术日期 | ${caseData.surgeryDate || caseData.date || '-'} |`);
  lines.push(`| 麻醉开始 | ${caseData.startTime || caseData.anesthesiaStart || '-'} |`);
  lines.push(`| 麻醉结束 | ${caseData.endTime || caseData.anesthesiaEnd || '-'} |`);
  
  if (caseData.anesthesiaDuration) {
    lines.push(`| 麻醉时长 | ${caseData.anesthesiaDuration} 分钟 |`);
  }
  
  lines.push('');
  
  lines.push(`## 风险评估`);
  lines.push('');
  
  const totalIssues = (caseData.errorCount || 0) + (caseData.warningCount || 0) + (caseData.infoCount || 0);
  
  if (totalIssues === 0) {
    lines.push('✅ 未检测到风险点，麻醉记录完整。');
  } else {
    lines.push(`| 风险级别 | 数量 |`);
    lines.push(`|----------|------|`);
    lines.push(`| 🔴 错误 | ${caseData.errorCount || 0} |`);
    lines.push(`| 🟡 警告 | ${caseData.warningCount || 0} |`);
    lines.push(`| 🔵 提示 | ${caseData.infoCount || 0} |`);
    lines.push('');
    
    if (caseData.issues && caseData.issues.length > 0) {
      lines.push(`### 详细问题列表`);
      lines.push('');
      
      caseData.issues.forEach((issue, index) => {
        const severityIcon = issue.severity === 'error' ? '🔴' : 
                              issue.severity === 'warning' ? '🟡' : '🔵';
        lines.push(`#### ${severityIcon} ${index + 1}. ${issue.title}`);
        lines.push('');
        lines.push(`- **类型**: ${issue.type}`);
        lines.push(`- **描述**: ${issue.description}`);
        if (issue.time) {
          lines.push(`- **时间**: ${formatDateTime(issue.time)}`);
        }
        lines.push('');
      });
    }
  }
  
  lines.push('');
  
  lines.push(`## 用药记录`);
  lines.push('');
  
  if (caseData.medications && caseData.medications.length > 0) {
    lines.push(`| 时间 | 药物名称 | 剂量 | 给药方式 |`);
    lines.push(`|------|----------|------|----------|`);
    
    caseData.medications.forEach(med => {
      const time = med.timestamp || med.adminTime;
      lines.push(`| ${time ? formatTime(time) : '-'} | ${med.drugName || med.name || '-'} | ${med.dosage || '-'} ${med.unit || ''} | ${med.route || '-'} |`);
    });
  } else {
    lines.push('暂无用药记录。');
  }
  
  lines.push('');
  
  lines.push(`## 生命体征摘要`);
  lines.push('');
  
  if (caseData.vitals && caseData.vitals.length > 0) {
    lines.push(`- **总记录数**: ${caseData.vitals.length} 条`);
    
    const hrValues = caseData.vitals
      .filter(v => v.heartRate && !isNaN(v.heartRate))
      .map(v => parseFloat(v.heartRate));
    
    if (hrValues.length > 0) {
      const minHr = Math.min(...hrValues);
      const maxHr = Math.max(...hrValues);
      const avgHr = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
      lines.push(`- **心率范围**: ${minHr} - ${maxHr} bpm (平均: ${Math.round(avgHr)} bpm)`);
    }
    
    const tempValues = caseData.vitals
      .filter(v => v.temperature && !isNaN(v.temperature))
      .map(v => parseFloat(v.temperature));
    
    if (tempValues.length > 0) {
      const minTemp = Math.min(...tempValues);
      const maxTemp = Math.max(...tempValues);
      const avgTemp = tempValues.reduce((a, b) => a + b, 0) / tempValues.length;
      lines.push(`- **体温范围**: ${minTemp.toFixed(1)} - ${maxTemp.toFixed(1)} °C (平均: ${avgTemp.toFixed(1)} °C)`);
    }
    
    const spo2Values = caseData.vitals
      .filter(v => v.spo2 && !isNaN(v.spo2))
      .map(v => parseFloat(v.spo2));
    
    if (spo2Values.length > 0) {
      const minSpo2 = Math.min(...spo2Values);
      const maxSpo2 = Math.max(...spo2Values);
      const avgSpo2 = spo2Values.reduce((a, b) => a + b, 0) / spo2Values.length;
      lines.push(`- **血氧饱和度范围**: ${minSpo2} - ${maxSpo2} % (平均: ${Math.round(avgSpo2)} %)`);
    }
    
    const etco2Values = caseData.vitals
      .filter(v => v.etco2 && !isNaN(v.etco2))
      .map(v => parseFloat(v.etco2));
    
    if (etco2Values.length > 0) {
      const minEtco2 = Math.min(...etco2Values);
      const maxEtco2 = Math.max(...etco2Values);
      const avgEtco2 = etco2Values.reduce((a, b) => a + b, 0) / etco2Values.length;
      lines.push(`- **呼气末二氧化碳范围**: ${minEtco2} - ${maxEtco2} mmHg (平均: ${Math.round(avgEtco2)} mmHg)`);
    }
    
    const bpValues = caseData.vitals
      .filter(v => v.systolicBP && !isNaN(v.systolicBP) && v.diastolicBP && !isNaN(v.diastolicBP))
      .map(v => ({ sys: parseFloat(v.systolicBP), dia: parseFloat(v.diastolicBP) }));
    
    if (bpValues.length > 0) {
      const sysValues = bpValues.map(v => v.sys);
      const diaValues = bpValues.map(v => v.dia);
      lines.push(`- **血压范围**: ${Math.min(...sysValues)}/${Math.min(...diaValues)} - ${Math.max(...sysValues)}/${Math.max(...diaValues)} mmHg`);
    }
  } else {
    lines.push('暂无生命体征记录。');
  }
  
  lines.push('');
  
  lines.push(`## 麻醉时间线`);
  lines.push('');
  
  if (caseData.timeline && caseData.timeline.length > 0) {
    const timelineByType = {
      event: [],
      medication: [],
      vitals: [],
      issue: []
    };
    
    caseData.timeline.forEach(item => {
      if (timelineByType[item.type]) {
        timelineByType[item.type].push(item);
      }
    });
    
    if (timelineByType.event.length > 0) {
      lines.push(`### 关键事件`);
      lines.push('');
      timelineByType.event.forEach(item => {
        lines.push(`- **${formatTime(item.time)}**: ${item.data.title}`);
        if (item.data.description) {
          lines.push(`  ${item.data.description}`);
        }
      });
      lines.push('');
    }
    
    if (timelineByType.medication.length > 0) {
      lines.push(`### 给药记录`);
      lines.push('');
      timelineByType.medication.forEach(item => {
        const med = item.data;
        lines.push(`- **${formatTime(item.time)}**: ${med.drugName || med.name} ${med.dosage || ''} ${med.unit || ''}`);
      });
      lines.push('');
    }
  }
  
  lines.push('');
  lines.push(`---`);
  lines.push(`*报告生成时间: ${new Date().toLocaleString('zh-CN')}*`);
  
  return lines.join('\n');
};

export const exportIssuesCsv = (issues) => {
  if (!issues || issues.length === 0) {
    return 'caseId,type,severity,title,description,time\n';
  }
  
  const headers = ['caseId', 'type', 'severity', 'title', 'description', 'time'];
  const lines = [headers.join(',')];
  
  issues.forEach(issue => {
    const row = [
      issue.caseId || '',
      issue.type || '',
      issue.severity || '',
      `"${(issue.title || '').replace(/"/g, '""')}"`,
      `"${(issue.description || '').replace(/"/g, '""')}"`,
      issue.time || issue.startTime || ''
    ];
    lines.push(row.join(','));
  });
  
  return lines.join('\n');
};
