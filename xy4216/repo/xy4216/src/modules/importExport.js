export class ImportExport {
  constructor() {
    this.onForkliftLoaded = null;
    this.onPedestrianLoaded = null;
    this.onWarehouseLoaded = null;
    this.onError = null;
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      
      reader.onerror = (e) => {
        reject(new Error(`读取文件失败: ${file.name}`));
      };
      
      reader.readAsText(file);
    });
  }

  async importForkliftCSV(file) {
    try {
      const text = await this.readFileAsText(file);
      if (this.onForkliftLoaded) {
        this.onForkliftLoaded(text, file.name);
      }
      return text;
    } catch (error) {
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  async importPedestrianJSON(file) {
    try {
      const text = await this.readFileAsText(file);
      if (this.onPedestrianLoaded) {
        this.onPedestrianLoaded(text, file.name);
      }
      return text;
    } catch (error) {
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  async importWarehouseJSON(file) {
    try {
      const text = await this.readFileAsText(file);
      if (this.onWarehouseLoaded) {
        this.onWarehouseLoaded(text, file.name);
      }
      return text;
    } catch (error) {
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  exportMarkdownReview(options = {}) {
    const {
      reviewDate = new Date().toISOString().split('T')[0],
      incidentTitle = '叉车盲区差点碰撞事故复盘',
      validationResults = null,
      riskPoints = [],
      forkliftData = null,
      pedestrianData = null,
      warehouseData = null,
      additionalNotes = ''
    } = options;

    let markdown = `# ${incidentTitle}\n\n`;
    markdown += `## 基本信息\n\n`;
    markdown += `- **复盘日期**: ${reviewDate}\n`;
    markdown += `- **复盘工具**: 3D叉车盲区复盘器\n\n`;

    if (forkliftData) {
      const forkliftTimes = forkliftData.map(d => d.timestamp).sort((a, b) => a - b);
      markdown += `### 叉车轨迹数据\n\n`;
      markdown += `- **数据条数**: ${forkliftData.length} 帧\n`;
      markdown += `- **起始时间**: ${forkliftTimes[0].toFixed(2)}s\n`;
      markdown += `- **结束时间**: ${forkliftTimes[forkliftTimes.length - 1].toFixed(2)}s\n`;
      markdown += `- **持续时长**: ${(forkliftTimes[forkliftTimes.length - 1] - forkliftTimes[0]).toFixed(2)}s\n\n`;
    }

    if (pedestrianData) {
      const pedestrianTimes = pedestrianData.map(d => d.timestamp).sort((a, b) => a - b);
      markdown += `### 行人定位数据\n\n`;
      markdown += `- **数据条数**: ${pedestrianData.length} 帧\n`;
      markdown += `- **起始时间**: ${pedestrianTimes[0].toFixed(2)}s\n`;
      markdown += `- **结束时间**: ${pedestrianTimes[pedestrianTimes.length - 1].toFixed(2)}s\n`;
      markdown += `- **持续时长**: ${(pedestrianTimes[pedestrianTimes.length - 1] - pedestrianTimes[0]).toFixed(2)}s\n\n`;
    }

    if (validationResults) {
      markdown += `## 数据校验结果\n\n`;
      markdown += `- **整体状态**: ${validationResults.isValid ? '✅ 通过' : '❌ 存在错误'}\n`;
      markdown += `- **错误数量**: ${validationResults.summary.totalErrors}\n`;
      markdown += `- **警告数量**: ${validationResults.summary.totalWarnings}\n\n`;

      if (validationResults.errors.length > 0) {
        markdown += `### 错误详情\n\n`;
        validationResults.errors.forEach((error, index) => {
          markdown += `${index + 1}. **[${error.category}]** ${error.message}\n`;
        });
        markdown += `\n`;
      }

      if (validationResults.warnings.length > 0) {
        markdown += `### 警告详情\n\n`;
        validationResults.warnings.forEach((warning, index) => {
          markdown += `${index + 1}. **[${warning.category}]** ${warning.message}\n`;
        });
        markdown += `\n`;
      }
    }

    markdown += `## 风险点分析\n\n`;
    
    if (riskPoints.length === 0) {
      markdown += `本次复盘未检测到风险点。\n\n`;
    } else {
      const highRisk = riskPoints.filter(r => r.level === 'high').length;
      const mediumRisk = riskPoints.filter(r => r.level === 'medium').length;
      const lowRisk = riskPoints.filter(r => r.level === 'low').length;

      markdown += `### 风险统计\n\n`;
      markdown += `- **总风险点数**: ${riskPoints.length}\n`;
      markdown += `- **高危**: ${highRisk} 个\n`;
      markdown += `- **中危**: ${mediumRisk} 个\n`;
      markdown += `- **低危**: ${lowRisk} 个\n\n`;

      markdown += `### 风险点详情\n\n`;
      riskPoints.forEach((risk, index) => {
        const levelLabel = risk.level === 'high' ? '🔴 高危' : 
                          risk.level === 'medium' ? '🟡 中危' : '🟢 低危';
        
        markdown += `#### 风险点 ${index + 1}: ${levelLabel}\n\n`;
        markdown += `- **类型**: ${risk.type === 'danger' ? '危险接近' : '风险预警'}\n`;
        markdown += `- **起始时间**: ${risk.startTime.toFixed(2)}s\n`;
        markdown += `- **结束时间**: ${risk.endTime.toFixed(2)}s\n`;
        markdown += `- **持续时长**: ${risk.duration.toFixed(2)}s\n`;
        markdown += `- **最小距离**: ${risk.minDistance.toFixed(2)}m\n`;
        
        if (risk.forkliftPositions && risk.forkliftPositions.start) {
          markdown += `- **叉车起始位置**: (${risk.forkliftPositions.start.x.toFixed(2)}, ${risk.forkliftPositions.start.z.toFixed(2)})\n`;
        }
        if (risk.pedestrianPositions && risk.pedestrianPositions.start) {
          markdown += `- **行人起始位置**: (${risk.pedestrianPositions.start.x.toFixed(2)}, ${risk.pedestrianPositions.start.z.toFixed(2)})\n`;
        }
        markdown += `\n`;
      });
    }

    markdown += `## 复盘结论与建议\n\n`;
    
    if (riskPoints.length > 0) {
      const nearestRisk = riskPoints.reduce((nearest, current) => 
        current.minDistance < nearest.minDistance ? current : nearest
      );
      
      markdown += `### 关键发现\n\n`;
      markdown += `1. **最接近点**: 在时间 ${nearestRisk.startTime.toFixed(2)}s 时，叉车与行人距离仅为 ${nearestRisk.minDistance.toFixed(2)}m\n`;
      markdown += `2. **风险时段**: 共检测到 ${riskPoints.length} 个风险时段，总持续时间 ${riskPoints.reduce((sum, r) => sum + r.duration, 0).toFixed(2)}s\n`;
      markdown += `3. **风险等级**: ${highRisk > 0 ? '存在高危风险，需立即整改' : '风险可控，但需持续关注'}\n\n`;
      
      markdown += `### 安全建议\n\n`;
      markdown += `1. **盲区警示**: 在叉车高频作业区域安装盲区检测系统\n`;
      markdown += `2. **行人防护**: 为作业人员配备定位标签和预警手环\n`;
      markdown += `3. **区域划分**: 明确划分人行通道和叉车通道，设置物理隔离\n`;
      markdown += `4. **培训教育**: 加强对叉车司机和作业人员的安全培训\n`;
      markdown += `5. **速度控制**: 在人员密集区域限制叉车行驶速度\n\n`;
    } else {
      markdown += `本次复盘未检测到明显风险点，数据显示叉车与行人保持了安全距离。\n\n`;
    }

    if (additionalNotes) {
      markdown += `### 附加说明\n\n`;
      markdown += `${additionalNotes}\n\n`;
    }

    markdown += `---\n\n`;
    markdown += `*此报告由 3D叉车盲区复盘器 自动生成*\n`;

    return markdown;
  }

  exportRiskJson(riskPoints, options = {}) {
    const {
      exportDate = new Date().toISOString(),
      includeDetails = true
    } = options;

    const exportData = {
      metadata: {
        exportDate,
        version: '1.0',
        totalRisks: riskPoints.length
      },
      riskPoints: riskPoints.map(risk => {
        const baseRisk = {
          id: risk.id,
          type: risk.type,
          level: risk.level,
          startTime: risk.startTime,
          endTime: risk.endTime,
          duration: risk.duration,
          minDistance: risk.minDistance
        };

        if (includeDetails) {
          baseRisk.forkliftPositions = risk.forkliftPositions;
          baseRisk.pedestrianPositions = risk.pedestrianPositions;
        }

        return baseRisk;
      }),
      statistics: {
        total: riskPoints.length,
        high: riskPoints.filter(r => r.level === 'high').length,
        medium: riskPoints.filter(r => r.level === 'medium').length,
        low: riskPoints.filter(r => r.level === 'low').length,
        avgDuration: riskPoints.length > 0 
          ? riskPoints.reduce((sum, r) => sum + r.duration, 0) / riskPoints.length 
          : 0,
        minDistance: riskPoints.length > 0 
          ? Math.min(...riskPoints.map(r => r.minDistance)) 
          : null
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  downloadMarkdown(content, filename = 'review-report.md') {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    this._downloadBlob(blob, filename);
  }

  downloadJson(content, filename = 'risk-points.json') {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    this._downloadBlob(blob, filename);
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export default ImportExport;
