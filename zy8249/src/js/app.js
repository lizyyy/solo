/**
 * 主应用程序
 * 整合数据解析、分析引擎和3D渲染
 */

import DataParser from './dataParser.js';
import AnalysisEngine from './analysisEngine.js';
import ThreeDRenderer from './threeDRenderer.js';

class InspectionApp {
  constructor() {
    this.dataParser = new DataParser();
    this.analysisEngine = null;
    this.renderer = null;
    
    this.isInitialized = false;
    this.showFlightPath = true;
    this.showDefects = true;
    this.filterSeverity = 'all';
    
    this.callbacks = {
      onDataLoaded: [],
      onAnalysisComplete: [],
      onSegmentClick: [],
      onDefectClick: []
    };
  }

  /**
   * 初始化应用
   */
  async init(containerId = 'canvas-container') {
    try {
      console.log('正在初始化风电场巡检可视化工具...');
      
      await this.dataParser.loadAllData();
      this.analysisEngine = new AnalysisEngine(this.dataParser);
      
      this.renderer = new ThreeDRenderer(containerId, this.dataParser);
      if (!this.renderer.init()) {
        throw new Error('3D渲染器初始化失败');
      }
      
      this.isInitialized = true;
      console.log('应用初始化完成');
      
      await this.runAnalysis();
      this.renderScene();
      this.notify('onDataLoaded', this.dataParser.getAllData());
      
      return true;
    } catch (error) {
      console.error('应用初始化失败:', error);
      throw error;
    }
  }

  /**
   * 运行分析
   */
  async runAnalysis() {
    if (!this.analysisEngine) {
      throw new Error('分析引擎未初始化');
    }
    
    const results = this.analysisEngine.analyzeAll();
    this.notify('onAnalysisComplete', results);
    
    return results;
  }

  /**
   * 渲染场景
   */
  renderScene() {
    if (!this.renderer) return;
    
    this.renderer.renderTurbine();
    
    if (this.showFlightPath) {
      this.renderer.renderFlightPath();
    }
    
    if (this.showDefects) {
      this.renderer.renderDefects();
    }
  }

  /**
   * 切换航线显示
   */
  toggleFlightPath(show) {
    this.showFlightPath = show !== undefined ? show : !this.showFlightPath;
    
    if (this.renderer) {
      if (this.showFlightPath) {
        this.renderer.renderFlightPath();
      } else {
        this.renderer.clearFlightPath();
      }
    }
    
    return this.showFlightPath;
  }

  /**
   * 切换缺陷显示
   */
  toggleDefects(show) {
    this.showDefects = show !== undefined ? show : !this.showDefects;
    
    if (this.renderer) {
      if (this.showDefects) {
        this.renderer.renderDefects();
      } else {
        this.renderer.clearDefects();
      }
    }
    
    return this.showDefects;
  }

  /**
   * 定位到特定段
   */
  focusOnSegment(segmentId) {
    if (this.renderer) {
      this.renderer.highlightSegment(segmentId);
      this.notify('onSegmentClick', segmentId);
    }
  }

  /**
   * 定位到特定缺陷
   */
  focusOnDefect(defectId) {
    const data = this.dataParser.getAllData();
    const defect = data.defects.find(d => d.defectId === defectId);
    
    if (defect) {
      const segment = this.dataParser.getSegmentByDistance(
        defect.bladeId,
        defect.distanceFromRoot
      );
      
      if (segment) {
        this.focusOnSegment(segment.segmentId);
      }
      
      this.notify('onDefectClick', defect);
    }
  }

  /**
   * 获取风机数据
   */
  getTurbineData() {
    return this.dataParser.getAllData().turbine;
  }

  /**
   * 获取分析结果
   */
  getAnalysisResults() {
    return this.analysisEngine ? this.analysisEngine.getAnalysisResults() : null;
  }

  /**
   * 获取所有数据
   */
  getAllData() {
    return this.dataParser.getAllData();
  }

  /**
   * 导出Markdown报告
   */
  exportMarkdownReport() {
    const data = this.getAllData();
    const analysis = this.getAnalysisResults();
    
    if (!data || !analysis) return '';

    const turbine = data.turbine;
    const defects = analysis.defects;
    const coverage = analysis.coverage;
    const windSpeed = analysis.windSpeed;
    const summary = analysis.summary;

    let markdown = `# 风机叶片无人机巡检报告\n\n`;
    markdown += `**风机编号**: ${turbine.turbineId}\n`;
    markdown += `**位置**: ${turbine.location}\n`;
    markdown += `**巡检日期**: ${turbine.inspectionDate}\n`;
    markdown += `**生成时间**: ${new Date().toISOString()}\n\n`;

    markdown += `## 综合评估\n\n`;
    markdown += `| 指标 | 值 |\n`;
    markdown += `|------|-----|\n`;
    markdown += `| 综合评分 | ${summary.overallScore}/100 |\n`;
    markdown += `| 整体状态 | ${summary.overallStatus === 'ok' ? '正常' : '需要关注'} |\n`;
    markdown += `| 覆盖率 | ${summary.keyMetrics.coveragePercentage}% |\n`;
    markdown += `| 高危缺陷 | ${summary.keyMetrics.highDefects} 个 |\n`;
    markdown += `| 总缺陷数 | ${summary.keyMetrics.totalDefects} 个 |\n`;
    markdown += `| 风速超限 | ${summary.keyMetrics.windExceeded} 次 |\n`;
    markdown += `| 最大风速 | ${summary.keyMetrics.maxWindSpeed} m/s |\n\n`;

    markdown += `## 问题摘要\n\n`;
    if (summary.issues.length > 0) {
      for (const issue of summary.issues) {
        const severityEmoji = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
        markdown += `${severityEmoji} **${issue.description}**\n\n`;
      }
    } else {
      markdown += `未发现重大问题\n\n`;
    }

    markdown += `## 覆盖情况分析\n\n`;
    markdown += `### 整体覆盖\n`;
    markdown += `- 总覆盖率: ${coverage.overall.coveragePercentage.toFixed(1)}%\n`;
    markdown += `- 覆盖不足段数: ${coverage.overall.missingSegments.length}\n`;
    markdown += `- 重复拍摄处数: ${coverage.overall.overlaps.length}\n\n`;

    if (coverage.overall.missingSegments.length > 0) {
      markdown += `### 覆盖不足的段\n\n`;
      markdown += `| 叶片 | 段ID | 段名称 | 覆盖率 | 照片数 | 需求 |\n`;
      markdown += `|------|------|--------|--------|--------|------|\n`;
      for (const seg of coverage.overall.missingSegments) {
        markdown += `| ${seg.bladeId} | ${seg.segmentId} | ${seg.segmentName} | ${seg.coveragePercentage}% | ${seg.photoCount} | ${seg.requiredPhotos} |\n`;
      }
      markdown += `\n`;
    }

    if (coverage.overall.overlaps.length > 0) {
      markdown += `### 重复拍摄\n\n`;
      markdown += `| 叶片 | 航线 | 重叠率 | 位置 |\n`;
      markdown += `|------|------|--------|------|\n`;
      for (const overlap of coverage.overall.overlaps) {
        markdown += `| ${overlap.bladeId} | ${overlap.flightIds.join(', ')} | ${(overlap.overlapPercentage * 100).toFixed(0)}% | ${overlap.overlapStart.toFixed(1)}m - ${overlap.overlapEnd.toFixed(1)}m |\n`;
      }
      markdown += `\n`;
    }

    markdown += `## 缺陷分析\n\n`;
    markdown += `### 缺陷统计\n`;
    markdown += `- 总缺陷数: ${defects.stats.total}\n`;
    markdown += `- 高危缺陷: ${defects.stats.high}\n`;
    markdown += `- 中危缺陷: ${defects.stats.medium}\n`;
    markdown += `- 低危缺陷: ${defects.stats.low}\n`;
    markdown += `- 边界缺陷: ${defects.stats.boundaryIssues}\n\n`;

    if (defects.bySeverity.high.length > 0) {
      markdown += `### 高危缺陷详情\n\n`;
      markdown += `| 缺陷ID | 叶片 | 位置 | 距离根端 | 尺寸 | 类型 | 建议 |\n`;
      markdown += `|--------|------|------|----------|------|------|------|\n`;
      for (const defect of defects.bySeverity.high) {
        const pos = this.getPositionText(defect.position);
        markdown += `| ${defect.defectId} | ${defect.bladeId} | ${pos} | ${defect.distanceFromRoot}m | ${defect.size}cm | ${this.getTypeText(defect.type)} | ${defect.analysis?.recommendedAction || '-'} |\n`;
      }
      markdown += `\n`;
    }

    if (defects.boundaryDefects.length > 0) {
      markdown += `### ⚠️ 边界段缺陷\n\n`;
      markdown += `以下缺陷位于段边界附近，请确认归属：\n\n`;
      markdown += `| 缺陷ID | 叶片 | 距离根端 | 边界段 | 边界类型 |\n`;
      markdown += `|--------|------|----------|--------|----------|\n`;
      for (const defect of defects.boundaryDefects) {
        const info = defect.analysis.boundaryInfo;
        markdown += `| ${defect.defectId} | ${defect.bladeId} | ${defect.distanceFromRoot}m | ${info.segmentName} | ${info.boundaryType === 'start' ? '段起始' : '段结束'} |\n`;
      }
      markdown += `\n`;
    }

    markdown += `## 风速分析\n\n`;
    markdown += `| 指标 | 值 |\n`;
    markdown += `|------|-----|\n`;
    markdown += `| 总飞行次数 | ${windSpeed.stats.total} |\n`;
    markdown += `| 最大风速 | ${windSpeed.stats.maxWindSpeed.toFixed(1)} m/s |\n`;
    markdown += `| 平均风速 | ${windSpeed.stats.avgWindSpeed.toFixed(1)} m/s |\n`;
    markdown += `| 超限次数 | ${windSpeed.stats.exceededCount} |\n`;
    markdown += `| 预警次数 | ${windSpeed.stats.warningCount} |\n\n`;

    if (windSpeed.exceeded.length > 0) {
      markdown += `### 风速超限记录\n\n`;
      markdown += `| 航线ID | 叶片 | 风速 | 时间 |\n`;
      markdown += `|--------|------|------|------|\n`;
      for (const flight of windSpeed.exceeded) {
        markdown += `| ${flight.flightId} | ${flight.bladeId} | ${flight.windSpeed.toFixed(1)} m/s | ${flight.timestamp} |\n`;
      }
      markdown += `\n`;
    }

    markdown += `## 建议\n\n`;
    if (summary.overallStatus === 'warning') {
      markdown += `### 立即处理\n`;
      const highIssues = summary.issues.filter(i => i.severity === 'high');
      for (const issue of highIssues) {
        markdown += `- [ ] ${issue.description}\n`;
      }
      markdown += `\n`;
    }

    markdown += `### 后续计划\n`;
    markdown += `- 对覆盖不足的段进行补拍\n`;
    markdown += `- 按优先级处理缺陷\n`;
    markdown += `- 下次巡检注意控制风速条件\n\n`;

    markdown += `---\n`;
    markdown += `*报告由风电场巡检可视化工具自动生成*\n`;

    return markdown;
  }

  /**
   * 导出CSV报告
   */
  exportCSVReport() {
    const data = this.getAllData();
    const analysis = this.getAnalysisResults();
    
    if (!data || !analysis) return '';

    const defects = analysis.defects;
    
    let csv = 'defectId,bladeId,segmentId,position,distanceFromRoot,size,type,severity,effectiveSeverity,isBoundary,recommendedAction,reviewStatus\n';
    
    for (const defect of defects.defects) {
      const row = [
        defect.defectId,
        defect.bladeId,
        defect.segmentId,
        this.getPositionText(defect.position),
        defect.distanceFromRoot,
        defect.size,
        this.getTypeText(defect.type),
        defect.severity,
        defect.analysis?.effectiveSeverity || defect.severity,
        defect.analysis?.isNearBoundary ? '是' : '否',
        `"${defect.analysis?.recommendedAction || ''}"`,
        defect.reviewStatus || 'unreviewed'
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * 获取位置文本
   */
  getPositionText(position) {
    const map = {
      pressure_side: '压力面',
      suction_side: '吸力面',
      leading_edge: '前缘',
      trailing_edge: '后缘'
    };
    return map[position] || position;
  }

  /**
   * 获取类型文本
   */
  getTypeText(type) {
    const map = {
      crack: '裂纹',
      pitting: '点蚀',
      erosion: '侵蚀',
      scratch: '划痕',
      bonding_issue: '粘接问题',
      delamination: '分层'
    };
    return map[type] || type;
  }

  /**
   * 下载文件
   */
  downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 导出并下载报告
   */
  downloadReport(format = 'markdown') {
    const timestamp = new Date().toISOString().slice(0, 10);
    
    if (format === 'markdown') {
      const content = this.exportMarkdownReport();
      this.downloadFile(content, `inspection-report-${timestamp}.md`, 'text/markdown');
    } else if (format === 'csv') {
      const content = this.exportCSVReport();
      this.downloadFile(content, `defects-${timestamp}.csv`, 'text/csv');
    }
  }

  /**
   * 标记缺陷为已复核
   */
  markDefectAsReviewed(defectId) {
    const data = this.getAllData();
    const defect = data.defects.find(d => d.defectId === defectId);
    
    if (defect) {
      defect.reviewStatus = 'reviewed';
      return true;
    }
    return false;
  }

  /**
   * 批量标记已复核
   */
  markMultipleAsReviewed(defectIds) {
    let count = 0;
    for (const id of defectIds) {
      if (this.markDefectAsReviewed(id)) {
        count++;
      }
    }
    return count;
  }

  /**
   * 注册回调
   */
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  /**
   * 通知回调
   */
  notify(event, data) {
    if (this.callbacks[event]) {
      for (const callback of this.callbacks[event]) {
        try {
          callback(data);
        } catch (e) {
          console.error(`回调执行错误 (${event}):`, e);
        }
      }
    }
  }

  /**
   * 销毁应用
   */
  destroy() {
    if (this.renderer) {
      this.renderer.destroy();
    }
    this.isInitialized = false;
  }
}

export default InspectionApp;
