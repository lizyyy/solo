/**
 * 报告导出系统模块
 * 生成Markdown格式的培训报告，包含事件回放、错误分析和改进建议
 */

class ReportGenerator {
  constructor() {
    this.levelInfo = null;
    this.scoreData = null;
    this.replayData = null;
    this.patientData = [];
    this.generatedAt = null;
  }

  setLevelInfo(levelInfo) {
    this.levelInfo = levelInfo;
  }

  setScoreData(scoreData) {
    this.scoreData = scoreData;
  }

  setReplayData(replayData) {
    this.replayData = replayData;
  }

  setPatientData(patientData) {
    this.patientData = patientData;
  }

  generateReport() {
    this.generatedAt = new Date();

    const report = [
      this.generateHeader(),
      this.generateOverview(),
      this.generateScoreBreakdown(),
      this.generateEventTimeline(),
      this.generateErrorAnalysis(),
      this.generatePatientSummary(),
      this.generateImprovementSuggestions(),
      this.generateFooter()
    ];

    return report.join('\n\n');
  }

  generateHeader() {
    const levelName = this.levelInfo?.name || '未知关卡';
    const dateStr = this.generatedAt.toLocaleString('zh-CN');

    return `# 急诊分诊夜班培训报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 关卡名称 | ${levelName} |
| 生成时间 | ${dateStr} |
| 报告版本 | 1.0 |`;
  }

  generateOverview() {
    if (!this.scoreData) {
      return '## 游戏概述\n\n暂无游戏数据。';
    }

    const score = this.scoreData.score || 0;
    const rating = this.scoreData.rating || { grade: '-', label: '未评级' };
    const totalPatients = this.patientData.length;

    const correctTriages = this.patientData.filter(p => 
      p.currentTriage === p.correctTriage
    ).length;

    const deterioratedPatients = this.patientData.filter(p => 
      p.hasDeteriorated
    ).length;

    const dischargedPatients = this.patientData.filter(p => 
      p.state === 'discharged'
    ).length;

    return `## 游戏概述

### 总体表现

| 指标 | 数值 |
|------|------|
| 最终得分 | ${score} 分 |
| 评级 | ${rating.grade} (${rating.label}) |
| 接诊患者数 | ${totalPatients} 人 |
| 正确分诊 | ${correctTriages} 人 |
| 病情恶化 | ${deterioratedPatients} 人 |
| 成功出院 | ${dischargedPatients} 人 |

### 评级说明

- **A级 (≥80分)**: 优秀 - 分诊准确，处理及时，资源利用合理
- **B级 (60-79分)**: 良好 - 基本掌握分诊技能，偶有失误
- **C级 (40-59分)**: 合格 - 需要加强高危患者识别能力
- **D级 (20-39分)**: 待改进 - 建议重新学习分诊标准流程
- **F级 (<20分)**: 不合格 - 需要系统培训急诊分诊知识`;
  }

  generateScoreBreakdown() {
    if (!this.scoreData || !this.scoreData.scoreDetails) {
      return '## 评分详情\n\n暂无评分数据。';
    }

    const details = this.scoreData.scoreDetails;
    const positiveDetails = details.filter(d => d.points > 0);
    const negativeDetails = details.filter(d => d.points < 0);

    let positiveTable = '';
    if (positiveDetails.length > 0) {
      positiveTable = `
### 加分项

| 序号 | 事件 | 分数 |
|------|------|------|
${positiveDetails.map((d, i) => 
  `| ${i + 1} | ${d.reason} | +${d.points} |`
).join('\n')}
`;
    }

    let negativeTable = '';
    if (negativeDetails.length > 0) {
      negativeTable = `
### 扣分项

| 序号 | 事件 | 分数 |
|------|------|------|
${negativeDetails.map((d, i) => 
  `| ${i + 1} | ${d.reason} | ${d.points} |`
).join('\n')}
`;
    }

    const totalPositive = positiveDetails.reduce((sum, d) => sum + d.points, 0);
    const totalNegative = negativeDetails.reduce((sum, d) => sum + d.points, 0);

    return `## 评分详情

### 分数汇总

| 项目 | 分数 |
|------|------|
| 加分总计 | +${totalPositive} |
| 扣分总计 | ${totalNegative} |
| 最终得分 | ${this.scoreData.score || 0} |
${positiveTable}${negativeTable}`;
  }

  generateEventTimeline() {
    if (!this.replayData || !this.replayData.events) {
      return '## 事件时间线\n\n暂无事件数据。';
    }

    const events = this.replayData.events
      .filter(e => e.type !== 'game_start' && e.type !== 'game_end')
      .sort((a, b) => a.timestamp - b.timestamp);

    if (events.length === 0) {
      return '## 事件时间线\n\n游戏过程中无关键事件。';
    }

    const timeline = events.map((event, index) => {
      const time = this.formatTime(event.timestamp);
      const description = this.getEventDescription(event);
      const emoji = this.getEventEmoji(event.type);
      
      return `| ${time} | ${emoji} | ${description} |`;
    }).join('\n');

    return `## 事件时间线

| 时间 | 类型 | 事件描述 |
|------|------|----------|
${timeline}

### 事件类型说明

- 🏥 患者到达
- 🎯 分诊操作
- ⚡ 动作开始
- ✅ 动作完成
- ⚠️ 病情恶化
- 🚪 患者出院
- ❌ 资源冲突
- ⏰ 等待超时`;
  }

  generateErrorAnalysis() {
    if (!this.replayData || !this.replayData.events) {
      return '## 错误分析\n\n暂无错误数据。';
    }

    const triageErrors = this.replayData.events.filter(e => 
      e.type === 'triage' && !e.data.wasCorrect
    );

    const deteriorationEvents = this.replayData.events.filter(e => 
      e.type === 'deterioration'
    );

    const isolationMissed = this.replayData.events.filter(e => 
      e.type === 'isolation_missed'
    );

    const resourceConflicts = this.replayData.events.filter(e => 
      e.type === 'resource_conflict'
    );

    const totalErrors = triageErrors.length + deteriorationEvents.length + 
                       isolationMissed.length + resourceConflicts.length;

    if (totalErrors === 0) {
      return `## 错误分析

🎉 **表现优秀！** 本局游戏未发现重大错误。

继续保持：
- 准确的分诊判断
- 及时的患者处理
- 合理的资源利用`;
    }

    let errorDetails = '';

    if (triageErrors.length > 0) {
      errorDetails += `
### 分诊错误 (${triageErrors.length} 次)

| 时间 | 患者 | 错误分诊 | 正确分诊 |
|------|------|----------|----------|
${triageErrors.map(e => `| ${this.formatTime(e.timestamp)} | ${e.data.patientId} | ${e.data.triageLevel} | ${e.data.correctTriage} |`).join('\n')}
`;
    }

    if (deteriorationEvents.length > 0) {
      errorDetails += `
### 病情恶化 (${deteriorationEvents.length} 次)

| 时间 | 患者 | 恶化原因 |
|------|------|----------|
${deteriorationEvents.map(e => `| ${this.formatTime(e.timestamp)} | ${e.data.patientId} | ${e.data.reason} |`).join('\n')}
`;
    }

    if (isolationMissed.length > 0) {
      errorDetails += `
### 隔离措施漏做 (${isolationMissed.length} 次)

| 时间 | 患者 |
|------|------|
${isolationMissed.map(e => `| ${this.formatTime(e.timestamp)} | ${e.data.patientId} |`).join('\n')}
`;
    }

    if (resourceConflicts.length > 0) {
      errorDetails += `
### 资源冲突 (${resourceConflicts.length} 次)

| 时间 | 患者 | 资源类型 |
|------|------|----------|
${resourceConflicts.map(e => `| ${this.formatTime(e.timestamp)} | ${e.data.patientId} | ${e.data.resourceType} |`).join('\n')}
`;
    }

    return `## 错误分析

### 错误汇总

| 错误类型 | 次数 |
|----------|------|
| 分诊错误 | ${triageErrors.length} |
| 病情恶化 | ${deteriorationEvents.length} |
| 隔离漏做 | ${isolationMissed.length} |
| 资源冲突 | ${resourceConflicts.length} |
| **总计** | **${totalErrors}** |
${errorDetails}`;
  }

  generatePatientSummary() {
    if (!this.patientData || this.patientData.length === 0) {
      return '## 患者处理详情\n\n暂无患者数据。';
    }

    const patientTables = this.patientData.map(patient => {
      const triageStatus = patient.currentTriage === patient.correctTriage ? '✅ 正确' : '❌ 错误';
      const statusEmoji = this.getPatientStatusEmoji(patient.state);
      const completedActions = patient.completedActions || [];
      const requiredActions = patient.requiredActions || [];
      const completedRequired = requiredActions.filter(a => 
        completedActions.some(c => c.actionId === a)
      ).length;

      return `
#### ${patient.id} - ${patient.chiefComplaint}

| 项目 | 内容 |
|------|------|
| 主诉 | ${patient.chiefComplaint} |
| 分诊状态 | ${patient.currentTriage || '未分诊'} (${triageStatus}) |
| 正确分诊 | ${patient.correctTriage} |
| 当前状态 | ${statusEmoji} ${patient.state} |
| 等待时间 | ${Math.round(patient.waitTime)} 秒 |
| 家属压力 | ${Math.round(patient.familyStress)}% |
| 完成动作 | ${completedActions.length} 项 |
| 必要动作完成 | ${completedRequired}/${requiredActions.length} |
| 病情恶化 | ${patient.hasDeteriorated ? '❌ 是' : '✅ 否'} |

${patient.riskFactors && patient.riskFactors.length > 0 ? 
  `**风险因素**: ${patient.riskFactors.join(', ')}` : ''}
`;
    }).join('');

    return `## 患者处理详情

共接诊 ${this.patientData.length} 名患者。
${patientTables}`;
  }

  generateImprovementSuggestions() {
    const suggestions = [];

    if (!this.replayData || !this.replayData.events) {
      return `## 改进建议

完成所有患者的正确分诊和及时处理是关键。建议：

1. **加强分诊标准学习**
   - 牢记红黄绿蓝四级分诊标准
   - 特别关注高危患者的识别

2. **优化时间管理**
   - 优先处理红色和黄色级别患者
   - 合理安排检查顺序

3. **资源利用**
   - 了解各资源的数量和使用限制
   - 避免资源冲突

4. **隔离意识**
   - 注意需要隔离的患者标识
   - 及时采取隔离措施`;
    }

    const triageErrors = this.replayData.events.filter(e => 
      e.type === 'triage' && !e.data.wasCorrect
    );

    const deteriorationEvents = this.replayData.events.filter(e => 
      e.type === 'deterioration'
    );

    const isolationMissed = this.replayData.events.filter(e => 
      e.type === 'isolation_missed'
    );

    const resourceConflicts = this.replayData.events.filter(e => 
      e.type === 'resource_conflict'
    );

    if (triageErrors.length > 0) {
      suggestions.push({
        priority: 'high',
        title: '加强分诊标准学习',
        details: [
          '本局出现 ' + triageErrors.length + ' 次分诊错误',
          '建议重新学习急诊分诊四级标准',
          '特别关注：胸痛、呼吸困难、意识改变等高危症状',
          '练习：识别不同主诉对应的正确分诊级别'
        ]
      });
    }

    if (deteriorationEvents.length > 0) {
      suggestions.push({
        priority: 'high',
        title: '优化时间管理和处理优先级',
        details: [
          '本局有 ' + deteriorationEvents.length + ' 名患者病情恶化',
          '分析恶化原因：' + this.getDeteriorationReasons(deteriorationEvents),
          '建议：优先处理红色和黄色级别患者',
          '设置时间提醒，避免患者等待超时'
        ]
      });
    }

    if (isolationMissed.length > 0) {
      suggestions.push({
        priority: 'medium',
        title: '提高隔离意识',
        details: [
          '本局有 ' + isolationMissed.length + ' 名患者隔离措施漏做',
          '注意查看患者卡片上的隔离标识',
          '发热、传染病患者需要优先隔离',
          '隔离措施可以减少交叉感染风险'
        ]
      });
    }

    if (resourceConflicts.length > 0) {
      suggestions.push({
        priority: 'medium',
        title: '合理规划资源使用',
        details: [
          '本局发生 ' + resourceConflicts.length + ' 次资源冲突',
          '了解各资源的可用数量',
          '规划动作顺序，避免同时占用同一资源',
          '考虑：心电图机和医生资源通常较为紧张'
        ]
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        priority: 'low',
        title: '保持优秀表现',
        details: [
          '本局表现优秀，未发现重大问题',
          '继续保持：准确分诊、及时处理、合理用资源',
          '挑战更高难度关卡',
          '尝试更快的处理速度'
        ]
      });
    }

    const suggestionsContent = suggestions.map((s, i) => `
### ${i + 1}. ${s.title} (${s.priority === 'high' ? '高优先级' : s.priority === 'medium' ? '中优先级' : '低优先级'})

${s.details.map(d => `- ${d}`).join('\n')}
`).join('');

    return `## 改进建议
${suggestionsContent}

---

### 学习资源推荐

1. **急诊分诊指南**
   - 四级分诊标准详解
   - 高危症状识别要点

2. **模拟练习**
   - 反复练习本关卡
   - 尝试不同处理策略

3. **复盘分析**
   - 对比正确处理流程
   - 分析每一个决策点`;
  }

  generateFooter() {
    return `---

*本报告由急诊分诊夜班游戏系统自动生成*

*报告生成时间: ${this.generatedAt.toLocaleString('zh-CN')}*`;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getEventDescription(event) {
    const descriptions = {
      'patient_arrival': `患者${event.data.patientId}到达：${event.data.chiefComplaint}`,
      'triage': `患者${event.data.patientId}分诊为${event.data.triageLevel}（${event.data.wasCorrect ? '正确' : '错误'}）`,
      'action_start': `患者${event.data.patientId}开始${event.data.actionType}`,
      'action_complete': `患者${event.data.patientId}完成${event.data.actionType}（${event.data.wasSuccessful ? '成功' : '失败'}）`,
      'deterioration': `患者${event.data.patientId}病情恶化：${event.data.reason}`,
      'discharge': `患者${event.data.patientId}出院（${event.data.wasSuccessful ? '成功' : '失败'}）`,
      'resource_conflict': `患者${event.data.patientId}资源冲突：${event.data.resourceType}`,
      'wait_timeout': `患者${event.data.patientId}等待超时：${event.data.waitTime}秒`,
      'isolation_missed': `患者${event.data.patientId}隔离措施漏做`
    };
    return descriptions[event.type] || event.type;
  }

  getEventEmoji(eventType) {
    const emojis = {
      'patient_arrival': '🏥',
      'triage': '🎯',
      'action_start': '⚡',
      'action_complete': '✅',
      'deterioration': '⚠️',
      'discharge': '🚪',
      'resource_conflict': '❌',
      'wait_timeout': '⏰',
      'isolation_missed': '🦠'
    };
    return emojis[eventType] || '📋';
  }

  getPatientStatusEmoji(state) {
    const emojis = {
      'pending': '⏳',
      'triaged': '🎯',
      'being_treated': '⚡',
      'waiting': '⏸️',
      'discharged': '✅',
      'deteriorated': '⚠️',
      'deceased': '❌'
    };
    return emojis[state] || '❓';
  }

  getDeteriorationReasons(events) {
    const reasons = events.map(e => e.data.reason);
    const uniqueReasons = [...new Set(reasons)];
    return uniqueReasons.join('、');
  }

  downloadReport(filename = '急诊分诊培训报告.md') {
    const reportContent = this.generateReport();
    const blob = new Blob([reportContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, message: '报告已下载' };
  }
}

function createReport(levelInfo, scoreData, replayData, patientData) {
  const generator = new ReportGenerator();
  generator.setLevelInfo(levelInfo);
  generator.setScoreData(scoreData);
  generator.setReplayData(replayData);
  generator.setPatientData(patientData);
  return generator.generateReport();
}

export {
  ReportGenerator,
  createReport
};
