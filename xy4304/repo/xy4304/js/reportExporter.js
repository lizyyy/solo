/**
 * 报告导出模块
 * 负责生成Markdown格式的训练报告
 */

import { levelLoader } from './levelLoader.js';

export const reportExporter = {
  /**
   * 生成Markdown格式的训练报告
   * @param {Object} gameSummary - 游戏摘要信息
   * @returns {string} Markdown格式的报告内容
   */
  generateMarkdownReport(gameSummary) {
    const zoneNames = {
      red: '红区（紧急）',
      yellow: '黄区（较重）',
      green: '绿区（普通）',
      black: '黑区（死亡/濒死）'
    };
    
    // 计算统计数据
    const totalPatients = gameSummary.totalPatients || 0;
    const processedPatients = gameSummary.totalProcessed || 0;
    const correctCount = gameSummary.correctCount || 0;
    const incorrectCount = gameSummary.incorrectCount || 0;
    const accuracy = gameSummary.accuracy || 0;
    
    // 获取错误案例
    const incorrectCases = gameSummary.processedPatients 
      ? gameSummary.processedPatients.filter(p => !p.isCorrect)
      : [];
    
    // 获取正确案例
    const correctCases = gameSummary.processedPatients
      ? gameSummary.processedPatients.filter(p => p.isCorrect)
      : [];
    
    // 生成报告
    let report = `# 急诊科分诊训练报告

## 一、基本信息

| 项目 | 内容 |
|------|------|
| 训练日期 | ${this._formatDate(gameSummary.playedAt)} |
| 关卡名称 | ${gameSummary.levelName || '未命名关卡'} |
| 关卡描述 | ${gameSummary.levelDescription || '无描述'} |
| 训练时长 | ${levelLoader.formatTime(gameSummary.timeUsed || 0)} |
| 总分 | ${gameSummary.score || 0} |
| 最高连击 | ${gameSummary.maxCombo || 0} |

## 二、训练结果

### 2.1 总体表现

- **准确率**：${accuracy}%
- **总患者数**：${totalPatients}人
- **已处理患者**：${processedPatients}人
- **正确分诊**：${correctCount}人
- **错误分诊**：${incorrectCount}人

### 2.2 分诊区域统计

| 分诊区域 | 分诊人数 | 正确人数 | 错误人数 |
|----------|----------|----------|----------|
`;

    // 添加各区域统计
    const zones = ['red', 'yellow', 'green', 'black'];
    zones.forEach(zone => {
      const zonePatients = gameSummary.patientsByZone 
        ? gameSummary.patientsByZone[zone] || []
        : [];
      const zoneCorrect = zonePatients.filter(p => p.isCorrect).length;
      const zoneIncorrect = zonePatients.length - zoneCorrect;
      
      report += `| ${zoneNames[zone]} | ${zonePatients.length} | ${zoneCorrect} | ${zoneIncorrect} |\n`;
    });

    // 添加错误案例分析部分
    if (incorrectCases.length > 0) {
      report += `
## 三、错误案例分析

以下是本次训练中分诊错误的案例，请仔细分析错误原因：

`;

      incorrectCases.forEach((patient, index) => {
        report += `### 案例 ${index + 1}：${patient.name}

**基本信息**：
- 年龄：${patient.age}岁
- 性别：${patient.gender}
- 主诉：${patient.chiefComplaint}

**生命体征**：
- 体温：${patient.vitalSigns.temperature}℃
- 脉搏：${patient.vitalSigns.pulse}次/分
- 呼吸：${patient.vitalSigns.respiration}次/分
- 血压：${patient.vitalSigns.bloodPressure.systolic}/${patient.vitalSigns.bloodPressure.diastolic}mmHg
- 血氧饱和度：${patient.vitalSigns.oxygenSaturation}%

**过敏史**：${patient.allergies && patient.allergies.length > 0 ? patient.allergies.join('、') : '无'}

**分诊情况**：
- 你的选择：${zoneNames[patient.selectedZone] || patient.selectedZone}
- 正确答案：${zoneNames[patient.correctZone] || patient.correctZone}

**错误原因**：
${patient.errorMessage || '未提供详细错误原因'}

**风险提示**：
${patient.riskHints && patient.riskHints.length > 0 
  ? patient.riskHints.map(hint => `- ${hint}`).join('\n')
  : '- 无特殊风险提示'}

---

`;
      });
    }

    // 添加正确案例分析部分
    if (correctCases.length > 0) {
      report += `
## 四、正确案例分析

以下是本次训练中分诊正确的案例，继续保持：

`;

      // 只显示前5个正确案例，避免报告过长
      const sampleCorrectCases = correctCases.slice(0, 5);
      
      sampleCorrectCases.forEach((patient, index) => {
        report += `### 案例 ${index + 1}：${patient.name}

- **主诉**：${patient.chiefComplaint}
- **分诊区域**：${zoneNames[patient.selectedZone] || patient.selectedZone}
- **得分变化**：${patient.scoreChange > 0 ? '+' : ''}${patient.scoreChange}分
${patient.riskHints && patient.riskHints.length > 0 
  ? `\n**风险提示**：\n${patient.riskHints.map(hint => `- ${hint}`).join('\n')}\n`
  : ''}
---

`;
      });
      
      if (correctCases.length > 5) {
        report += `> 注：还有 ${correctCases.length - 5} 个正确案例未在报告中显示。\n\n`;
      }
    }

    // 添加学习建议部分
    report += `
## 五、学习建议

根据本次训练表现，给出以下建议：

`;

    // 根据表现生成建议
    const suggestions = this._generateSuggestions(gameSummary, incorrectCases);
    suggestions.forEach((suggestion, index) => {
      report += `${index + 1}. ${suggestion}\n\n`;
    });

    // 添加分诊规则回顾部分
    report += `
## 六、分诊规则回顾

### 6.1 红区（紧急）指征
- 呼吸心跳骤停
- 严重呼吸困难
- 休克（收缩压<90mmHg）
- 昏迷
- 抽搐发作
- 严重创伤
- 急性胸痛伴生命体征不稳定
- 急性脑卒中
- 药物过量伴意识障碍
- 严重过敏反应

### 6.2 黄区（较重）指征
- 急性胸痛但生命体征稳定
- 腹痛较剧烈
- 高热（>39℃）
- 中度创伤
- 眩晕、呕吐
- 呼吸困难但生命体征稳定
- 急性尿潴留
- 精神状态改变

### 6.3 绿区（普通）指征
- 轻微创伤
- 轻度发热
- 感冒症状
- 慢性疾病常规复诊
- 轻微疼痛
- 皮肤问题

### 6.4 黑区（死亡/濒死）指征
- 明确死亡
- 不可逆性昏迷
- 严重创伤无生命体征
- 终末期疾病病情恶化

## 七、特殊风险提示

1. **胸痛伴低血压**：提示可能为急性心肌梗死或主动脉夹层，需紧急处理
2. **儿童高热**：需警惕热性惊厥，触发复测提示
3. **意识改变伴发热**：提示可能为中枢神经系统感染
4. **外伤伴低血压**：提示可能为失血性休克
5. **过敏史**：用药时需特别注意，避免使用过敏药物

---

*报告生成时间：${this._formatDateTime(new Date().toISOString())}*
*本报告由急诊科分诊训练系统自动生成*
`;

    return report;
  },

  /**
   * 导出报告为文件
   * @param {string} content - 报告内容
   * @param {string} filename - 文件名（可选）
   */
  exportToFile(content, filename = null) {
    // 生成默认文件名
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      filename = `triage-training-report-${timestamp}.md`;
    }
    
    // 创建Blob对象
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * 生成学习建议
   * @private
   * @param {Object} gameSummary - 游戏摘要
   * @param {Array} incorrectCases - 错误案例
   * @returns {Array<string>} 建议列表
   */
  _generateSuggestions(gameSummary, incorrectCases) {
    const suggestions = [];
    const accuracy = gameSummary.accuracy || 0;
    
    // 总体准确率建议
    if (accuracy < 60) {
      suggestions.push('你的准确率较低，建议先复习分诊规则，特别是红区和黄区的指征。');
      suggestions.push('可以从基础关卡开始练习，熟悉各种病例的分诊要点。');
    } else if (accuracy < 80) {
      suggestions.push('你的准确率还有提升空间，建议重点关注容易混淆的病例。');
      suggestions.push('特别注意生命体征的解读，如低血压、低血氧等危险信号。');
    } else {
      suggestions.push('你的表现很好！继续保持，挑战更高难度的关卡。');
      suggestions.push('可以尝试分析复杂病例，提高综合判断能力。');
    }
    
    // 根据错误类型提供建议
    const redErrors = incorrectCases.filter(p => p.correctZone === 'red');
    const yellowErrors = incorrectCases.filter(p => p.correctZone === 'yellow');
    const greenErrors = incorrectCases.filter(p => p.correctZone === 'green');
    const blackErrors = incorrectCases.filter(p => p.correctZone === 'black');
    
    if (redErrors.length > 0) {
      suggestions.push(`你有 ${redErrors.length} 例红区患者分诊错误，建议重点复习红区指征，特别是休克、意识障碍、严重胸痛等紧急情况。`);
    }
    
    if (yellowErrors.length > 0) {
      suggestions.push(`你有 ${yellowErrors.length} 例黄区患者分诊错误，黄区病例通常需要综合判断，建议多练习中等难度的病例。`);
    }
    
    if (greenErrors.length > 0) {
      suggestions.push(`你有 ${greenErrors.length} 例绿区患者分诊错误，注意区分普通症状和需要优先处理的情况。`);
    }
    
    if (blackErrors.length > 0) {
      suggestions.push(`你有 ${blackErrors.length} 例黑区患者分诊错误，注意识别死亡或濒死状态的指征。`);
    }
    
    // 连击建议
    if (gameSummary.maxCombo < 3) {
      suggestions.push('你的最高连击较低，建议在练习时保持专注，减少分心。');
    } else if (gameSummary.maxCombo < 5) {
      suggestions.push('你有一定的连击能力，继续保持可以获得更高分数。');
    } else {
      suggestions.push('你的连击表现很好！连续正确分诊可以获得额外分数奖励。');
    }
    
    // 通用建议
    suggestions.push('每次练习后仔细查看错误案例分析，理解错误原因。');
    suggestions.push('注意观察患者的生命体征，特别是血压、血氧饱和度等关键指标。');
    suggestions.push('儿童、老年患者的病情变化可能较快，需要特别关注。');
    
    // 去重并返回前5条建议
    const uniqueSuggestions = [...new Set(suggestions)];
    return uniqueSuggestions.slice(0, 5);
  },

  /**
   * 格式化日期
   * @private
   * @param {string} isoString - ISO日期字符串
   * @returns {string} 格式化的日期
   */
  _formatDate(isoString) {
    if (!isoString) return '未知';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });
    } catch (e) {
      return '未知';
    }
  },

  /**
   * 格式化日期时间
   * @private
   * @param {string} isoString - ISO日期字符串
   * @returns {string} 格式化的日期时间
   */
  _formatDateTime(isoString) {
    if (!isoString) return '未知';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return '未知';
    }
  },

  /**
   * 快速生成并导出报告
   * @param {Object} gameSummary - 游戏摘要
   * @param {string} filename - 文件名（可选）
   */
  quickExport(gameSummary, filename = null) {
    const report = this.generateMarkdownReport(gameSummary);
    this.exportToFile(report, filename);
  }
};

export default reportExporter;
