/**
 * 报告导出模块
 * 负责导出Markdown和JSON格式的结算报告
 */

export class Exporter {
  constructor() {
    this.dateFormatter = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 导出JSON格式的结算报告
   * @param {Object} level - 关卡数据
   * @param {Array} placedStalls - 已放置的摊位
   * @param {Object} evaluation - 评估结果
   * @returns {Object} JSON数据
   */
  exportJSON(level, placedStalls, evaluation) {
    const highScore = this.getHighScore(level.id);
    
    return {
      reportType: 'marketGameResult',
      version: '1.0',
      generatedAt: new Date().toISOString(),
      level: {
        id: level.id,
        name: level.name,
        description: level.description,
        gridSize: level.gridSize,
        budget: level.budget,
        maxElectricity: level.maxElectricity
      },
      layout: {
        placedStalls: placedStalls.map(stall => ({
          id: stall.id,
          name: stall.name,
          category: stall.category,
          position: stall.position,
          size: stall.size,
          cost: stall.cost,
          electricity: stall.electricity,
          noise: stall.noise,
          odor: stall.odor,
          attraction: stall.attraction,
          incomePerPerson: stall.incomePerPerson
        })),
        totalPlaced: placedStalls.length
      },
      evaluation: {
        score: evaluation.score,
        satisfaction: evaluation.satisfaction,
        risk: evaluation.risk,
        income: evaluation.income,
        budget: evaluation.budget,
        electricity: evaluation.electricity,
        conflicts: evaluation.conflicts,
        bonuses: evaluation.bonuses,
        stallDetails: evaluation.stallDetails,
        visitorFlow: evaluation.visitorFlow
      },
      objectives: level.objectives.map(obj => {
        let achieved = false;
        let currentValue = 0;
        
        switch (obj.type) {
          case 'minIncome':
            currentValue = evaluation.income;
            achieved = evaluation.income >= obj.target;
            break;
          case 'maxSatisfaction':
            currentValue = evaluation.satisfaction;
            achieved = evaluation.satisfaction >= obj.target;
            break;
          case 'minRisk':
            currentValue = evaluation.risk;
            achieved = evaluation.risk <= obj.target;
            break;
          case 'maxStalls':
            currentValue = placedStalls.length;
            achieved = placedStalls.length >= obj.target;
            break;
        }
        
        return {
          ...obj,
          currentValue,
          achieved
        };
      }),
      comparison: highScore ? {
        isNewHighScore: evaluation.score > highScore.score,
        previousHighScore: highScore.score,
        difference: evaluation.score - highScore.score
      } : {
        isNewHighScore: true,
        previousHighScore: null,
        difference: null
      }
    };
  }

  /**
   * 导出Markdown格式的结算报告
   * @param {Object} level - 关卡数据
   * @param {Array} placedStalls - 已放置的摊位
   * @param {Object} evaluation - 评估结果
   * @returns {string} Markdown文本
   */
  exportMarkdown(level, placedStalls, evaluation) {
    const highScore = this.getHighScore(level.id);
    const jsonData = this.exportJSON(level, placedStalls, evaluation);
    const objectives = jsonData.objectives;
    
    let md = `# 周末市集摊位摆位 - 结算报告\n\n`;
    
    // 基本信息
    md += `## 基本信息\n\n`;
    md += `- **关卡**: ${level.name}\n`;
    md += `- **结算时间**: ${this.dateFormatter.format(new Date())}\n`;
    md += `- **已放置摊位**: ${placedStalls.length} 个\n\n`;
    
    // 综合评分
    md += `## 综合评分\n\n`;
    md += `| 指标 | 分数 | 评价 |\n`;
    md += `|------|------|------|\n`;
    md += `| **总分** | ${evaluation.score} | ${this.getScoreRating(evaluation.score)} |\n`;
    md += `| **满意度** | ${evaluation.satisfaction.toFixed(1)} / 100 | ${this.getSatisfactionRating(evaluation.satisfaction)} |\n`;
    md += `| **风险度** | ${evaluation.risk.toFixed(1)} / 100 | ${this.getRiskRating(evaluation.risk)} |\n`;
    md += `| **预估收入** | ${evaluation.income} 元 | - |\n\n`;
    
    // 最高分对比
    if (highScore) {
      const isNew = evaluation.score > highScore.score;
      md += `### 最高分对比\n\n`;
      md += `- **当前分数**: ${evaluation.score}\n`;
      md += `- **历史最高**: ${highScore.score}\n`;
      md += `- **结果**: ${isNew ? `🎉 新纪录！(+${evaluation.score - highScore.score})` : `差距 ${highScore.score - evaluation.score} 分`}\n\n`;
    }
    
    // 资源使用
    md += `## 资源使用\n\n`;
    md += `### 预算\n`;
    md += `- 总预算: ${level.budget} 元\n`;
    md += `- 已使用: ${evaluation.budget.used} 元\n`;
    md += `- 剩余: ${evaluation.budget.remaining} 元\n`;
    md += `- 状态: ${evaluation.budget.overrun ? '❌ 超支' : '✅ 正常'}\n\n`;
    
    md += `### 电力\n`;
    md += `- 总容量: ${level.maxElectricity} 单位\n`;
    md += `- 已使用: ${evaluation.electricity.used} 单位\n`;
    md += `- 剩余: ${evaluation.electricity.remaining} 单位\n`;
    md += `- 状态: ${evaluation.electricity.overload ? '❌ 过载' : '✅ 正常'}\n\n`;
    
    // 目标完成情况
    md += `## 目标完成情况\n\n`;
    objectives.forEach(obj => {
      const icon = obj.achieved ? '✅' : '❌';
      md += `${icon} **${obj.description}**\n`;
      md += `   - 目标值: ${obj.target}\n`;
      md += `   - 当前值: ${obj.currentValue}\n`;
      md += `   - 权重: ${obj.weight}\n\n`;
    });
    
    // 摊位详情
    md += `## 摊位详情\n\n`;
    md += `| 摊位名称 | 分类 | 位置 | 费用 | 电力 | 客流 | 预估收入 |\n`;
    md += `|----------|------|------|------|------|------|----------|\n`;
    
    evaluation.stallDetails.forEach(detail => {
      const stall = placedStalls.find(s => s.id === detail.stall);
      if (stall) {
        md += `| ${stall.name} | ${stall.categoryName} | (${stall.position.x},${stall.position.y}) | ${stall.cost} | ${stall.electricity} | ${detail.visitors} | ${detail.income} |\n`;
      }
    });
    md += `\n`;
    
    // 冲突警告
    if (evaluation.conflicts.length > 0) {
      md += `## ⚠️ 冲突警告\n\n`;
      evaluation.conflicts.forEach((conflict, index) => {
        const severityIcon = conflict.severity === 'critical' ? '🔴' : 
                            conflict.severity === 'high' ? '🟠' : '🟡';
        md += `${index + 1}. ${severityIcon} **${this.getConflictTypeLabel(conflict.type)}**\n`;
        md += `   - 描述: ${conflict.message}\n`;
        md += `   - 惩罚分数: ${conflict.penalty}\n\n`;
      });
    }
    
    // 加成奖励
    if (evaluation.bonuses.length > 0) {
      md += `## ✨ 加成奖励\n\n`;
      evaluation.bonuses.forEach((bonus, index) => {
        md += `${index + 1}. 🟢 **${this.getBonusTypeLabel(bonus.type)}**\n`;
        md += `   - 描述: ${bonus.message}\n`;
        if (bonus.description) {
          md += `   - 说明: ${bonus.description}\n`;
        }
        md += `   - 奖励分数: +${bonus.bonus}\n\n`;
      });
    }
    
    // 人流分析
    md += `## 人流分析\n\n`;
    if (evaluation.visitorFlow) {
      md += `- 总预计访客: ${evaluation.visitorFlow.totalVisitors} 人\n`;
      md += `- 实际分布访客: ${evaluation.visitorFlow.distributedVisitors} 人\n`;
      md += `- 流失率: ${((1 - evaluation.visitorFlow.distributedVisitors / evaluation.visitorFlow.totalVisitors) * 100).toFixed(1)}%\n\n`;
    }
    
    // 结语
    md += `---\n\n`;
    md += `*报告生成时间: ${new Date().toISOString()}*\n`;
    md += `*游戏: 周末市集摊位摆位*\n`;
    
    return md;
  }

  /**
   * 下载文件
   * @param {string} content - 文件内容
   * @param {string} filename - 文件名
   * @param {string} mimeType - MIME类型
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * 导出并下载JSON报告
   */
  exportAndDownloadJSON(level, placedStalls, evaluation) {
    const data = this.exportJSON(level, placedStalls, evaluation);
    const filename = `市集结算_${level.id}_${this.getTimestamp()}.json`;
    this.downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
  }

  /**
   * 导出并下载Markdown报告
   */
  exportAndDownloadMarkdown(level, placedStalls, evaluation) {
    const content = this.exportMarkdown(level, placedStalls, evaluation);
    const filename = `市集结算_${level.id}_${this.getTimestamp()}.md`;
    this.downloadFile(content, filename, 'text/markdown');
  }

  /**
   * 导入关卡JSON
   * @param {File} file - JSON文件
   * @returns {Promise<Object>} 解析后的关卡数据
   */
  importLevel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error('JSON格式错误'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * 获取评分等级
   */
  getScoreRating(score) {
    if (score >= 200) return '🌟 卓越';
    if (score >= 150) return '⭐ 优秀';
    if (score >= 100) return '👍 良好';
    if (score >= 50) return '😊 及格';
    return '😅 需要改进';
  }

  /**
   * 获取满意度评级
   */
  getSatisfactionRating(satisfaction) {
    if (satisfaction >= 90) return '非常满意';
    if (satisfaction >= 75) return '满意';
    if (satisfaction >= 60) return '一般';
    return '不满意';
  }

  /**
   * 获取风险评级
   */
  getRiskRating(risk) {
    if (risk <= 20) return '低风险';
    if (risk <= 40) return '中低风险';
    if (risk <= 60) return '中等风险';
    if (risk <= 80) return '中高风险';
    return '高风险';
  }

  /**
   * 获取冲突类型标签
   */
  getConflictTypeLabel(type) {
    const labels = {
      budget: '预算超支',
      electricity: '用电过载',
      fireExit: '消防通道占用',
      noise: '噪音冲突',
      odor: '气味冲突',
      specificConflict: '摊位冲突'
    };
    return labels[type] || type;
  }

  /**
   * 获取加成类型标签
   */
  getBonusTypeLabel(type) {
    const labels = {
      adjacent: '相邻加成',
      specificAdjacent: '特殊相邻加成',
      entranceProximity: '入口邻近加成'
    };
    return labels[type] || type;
  }

  /**
   * 获取时间戳
   */
  getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * 获取最高分
   */
  getHighScore(levelId) {
    try {
      const data = localStorage.getItem('marketGame_highScores');
      if (data) {
        const scores = JSON.parse(data);
        return scores[levelId] || null;
      }
    } catch (e) {
      console.error('读取最高分失败:', e);
    }
    return null;
  }
}

export const exporter = new Exporter();
