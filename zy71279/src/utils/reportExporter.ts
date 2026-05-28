import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type {
  EstimationTask,
  ErrorAnalysis,
  PrintEstimation,
  ConstraintCheck,
  Material,
  DetailedError
} from '@/types';
import { formatNumber, formatTime } from './math';

export interface ReportData {
  task: EstimationTask;
  errorAnalysis?: ErrorAnalysis;
  printEstimation?: PrintEstimation;
  constraintChecks: ConstraintCheck[];
  material?: Material;
  qualityErrors: DetailedError[];
}

export interface ComparisonReportData {
  tasks: ReportData[];
  title: string;
}

export class ReportExporter {
  private static readonly CHINESE_FONT = 'helvetica';

  static async exportToPDF(data: ReportData): Promise<Blob> {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('3D打印网格简化误差估计报告', 105, y, { align: 'center' });
    y += 15;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 14, y);
    y += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('一、任务基本信息', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const basicInfo = [
      `模型名称: ${data.task.modelName}`,
      `原始面数: ${data.task.originalFaces.toLocaleString()}`,
      `简化后面数: ${data.task.simplifiedFaces.toLocaleString()}`,
      `简化比例: ${(data.task.simplificationRatio * 100).toFixed(1)}%`,
      `简化算法: ${this.getAlgorithmName(data.task.algorithm)}`,
      `误差阈值: ${data.task.errorThreshold.toFixed(4)} mm`,
      `层厚: ${data.task.layerHeight.toFixed(2)} mm`,
      `填充率: ${data.task.infillRate.toFixed(0)}%`,
      `材料: ${data.material?.name || '未选择'} (${data.material?.code || '-'})`,
      `任务状态: ${this.getStatusText(data.task.status)}`
    ];

    for (const line of basicInfo) {
      doc.text(line, 14, y);
      y += 6;
    }

    if (data.errorAnalysis) {
      y += 5;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('二、误差分析结果', 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const errorInfo = [
        `最大误差: ${data.errorAnalysis.maxError.toFixed(4)} mm`,
        `最小误差: ${data.errorAnalysis.minError.toFixed(4)} mm`,
        `平均误差: ${data.errorAnalysis.meanError.toFixed(4)} mm`,
        `标准差: ${data.errorAnalysis.stdDeviation.toFixed(4)} mm`,
        `模型体积: ${data.errorAnalysis.volume.toFixed(4)} cm³`,
        `表面积: ${data.errorAnalysis.surfaceArea.toFixed(4)} cm²`
      ];

      for (const line of errorInfo) {
        doc.text(line, 14, y);
        y += 6;
      }

      y += 4;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('拓扑质量检查:', 14, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const topologyInfo = [
        `法线一致性: ${data.errorAnalysis.hasNormalFlip ? '❌ 存在翻转' : '✅ 一致'} (${data.errorAnalysis.normalFlipCount} 处)`,
        `模型封闭性: ${data.errorAnalysis.hasHoles ? '⚠️ 存在孔洞' : '✅ 封闭'} (${data.errorAnalysis.holeCount} 个)`
      ];

      for (const line of topologyInfo) {
        doc.text(line, 14, y);
        y += 6;
      }
    }

    if (data.printEstimation) {
      y += 5;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('三、打印估算结果', 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const printInfo = [
        `预估打印时间: ${formatTime(data.printEstimation.printTimeHours)}`,
        `材料用量: ${data.printEstimation.materialWeight.toFixed(2)} g`,
        `材料成本: ¥${data.printEstimation.materialCost.toFixed(2)}`,
        `能耗: ${data.printEstimation.energyConsumption.toFixed(2)} kWh`,
        `总成本: ¥${data.printEstimation.totalCost.toFixed(2)}`
      ];

      for (const line of printInfo) {
        doc.text(line, 14, y);
        y += 6;
      }
    }

    if (data.constraintChecks.length > 0) {
      y += 5;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('四、约束检查结果', 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      for (const check of data.constraintChecks) {
        const status = check.passed ? '✅' : '❌';
        const severity = check.severity === 'error' ? '[ERROR]' :
                        check.severity === 'warning' ? '[WARN]' : '[INFO]';
        doc.text(`${status} ${severity} ${check.constraintName}: ${check.details}`, 14, y);
        y += 6;

        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      }
    }

    if (data.qualityErrors.length > 0) {
      y += 5;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('五、详细问题列表', 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      for (let i = 0; i < Math.min(data.qualityErrors.length, 20); i++) {
        const error = data.qualityErrors[i];
        const severity = error.severity === 'error' ? '[ERROR]' :
                        error.severity === 'warning' ? '[WARN]' : '[INFO]';
        const typeText = this.getErrorTypeText(error.type);

        let line = `${i + 1}. ${severity} [${typeText}] ${error.message}`;
        if (error.faceIndex !== undefined) {
          line += ` (面 ${error.faceIndex})`;
        }

        doc.text(line, 14, y);
        y += 6;

        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      }

      if (data.qualityErrors.length > 20) {
        doc.text(`... 还有 ${data.qualityErrors.length - 20} 条问题未显示`, 14, y);
      }
    }

    return doc.output('blob');
  }

  static exportToExcel(data: ReportData[]): Blob {
    const wb = XLSX.utils.book_new();

    const tasksData = data.map(d => ({
      '任务ID': d.task.id,
      '模型名称': d.task.modelName,
      '原始面数': d.task.originalFaces,
      '简化后面数': d.task.simplifiedFaces,
      '简化比例(%)': (d.task.simplificationRatio * 100).toFixed(1),
      '算法': this.getAlgorithmName(d.task.algorithm),
      '误差阈值(mm)': d.task.errorThreshold,
      '层厚(mm)': d.task.layerHeight,
      '填充率(%)': d.task.infillRate,
      '材料': d.material?.name || '-',
      '材料编号': d.material?.code || '-',
      '最大误差(mm)': d.errorAnalysis?.maxError.toFixed(4) || '-',
      '平均误差(mm)': d.errorAnalysis?.meanError.toFixed(4) || '-',
      '标准差(mm)': d.errorAnalysis?.stdDeviation.toFixed(4) || '-',
      '体积(cm³)': d.errorAnalysis?.volume.toFixed(4) || '-',
      '表面积(cm²)': d.errorAnalysis?.surfaceArea.toFixed(4) || '-',
      '打印时间(小时)': d.printEstimation?.printTimeHours.toFixed(2) || '-',
      '材料重量(g)': d.printEstimation?.materialWeight.toFixed(2) || '-',
      '总成本(元)': d.printEstimation?.totalCost.toFixed(2) || '-',
      '状态': this.getStatusText(d.task.status),
      '创建时间': new Date(d.task.createdAt).toLocaleString('zh-CN')
    }));

    const ws1 = XLSX.utils.json_to_sheet(tasksData);
    XLSX.utils.book_append_sheet(wb, ws1, '任务汇总');

    if (data.length > 0 && data[0].constraintChecks.length > 0) {
      const constraintData = data.flatMap(d =>
        d.constraintChecks.map(c => ({
          '任务ID': d.task.id,
          '模型名称': d.task.modelName,
          '约束名称': c.constraintName,
          '是否通过': c.passed ? '是' : '否',
          '严重程度': c.severity,
          '实际值': c.actualValue,
          '允许值': c.allowedValue,
          '详细说明': c.details
        }))
      );

      const ws2 = XLSX.utils.json_to_sheet(constraintData);
      XLSX.utils.book_append_sheet(wb, ws2, '约束检查');
    }

    if (data.some(d => d.qualityErrors.length > 0)) {
      const errorData = data.flatMap(d =>
        d.qualityErrors.map((e, idx) => ({
          '任务ID': d.task.id,
          '模型名称': d.task.modelName,
          '序号': idx + 1,
          '错误类型': this.getErrorTypeText(e.type),
          '严重程度': e.severity,
          '消息': e.message,
          '面索引': e.faceIndex !== undefined ? e.faceIndex : '-',
          '位置': e.location ? `(${e.location[0].toFixed(3)}, ${e.location[1].toFixed(3)}, ${e.location[2].toFixed(3)})` : '-'
        }))
      );

      const ws3 = XLSX.utils.json_to_sheet(errorData);
      XLSX.utils.book_append_sheet(wb, ws3, '详细错误');
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  static exportToJSON(data: ReportData | ReportData[]): Blob {
    const exportData = Array.isArray(data) ? data.map(d => this.sanitizeForJSON(d)) : this.sanitizeForJSON(data);
    const jsonStr = JSON.stringify(exportData, null, 2);
    return new Blob([jsonStr], { type: 'application/json' });
  }

  static async generateComparisonReport(data: ComparisonReportData): Promise<Blob> {
    const doc = new jsPDF('l', 'mm', 'a4');
    let y = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.title || '多方案对比报告', 148, y, { align: 'center' });
    y += 15;

    doc.setFontSize(10);
    doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 10, y);
    y += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('方案对比表', 10, y);
    y += 8;

    const headers = ['指标', ...data.tasks.map((_, i) => `方案 ${i + 1}`)];
    const metrics = [
      { name: '模型名称', value: (d: ReportData) => d.task.modelName },
      { name: '原始面数', value: (d: ReportData) => d.task.originalFaces.toLocaleString() },
      { name: '简化后面数', value: (d: ReportData) => d.task.simplifiedFaces.toLocaleString() },
      { name: '简化比例', value: (d: ReportData) => (d.task.simplificationRatio * 100).toFixed(1) + '%' },
      { name: '最大误差(mm)', value: (d: ReportData) => d.errorAnalysis?.maxError.toFixed(4) || '-' },
      { name: '平均误差(mm)', value: (d: ReportData) => d.errorAnalysis?.meanError.toFixed(4) || '-' },
      { name: '标准差(mm)', value: (d: ReportData) => d.errorAnalysis?.stdDeviation.toFixed(4) || '-' },
      { name: '打印时间', value: (d: ReportData) => d.printEstimation ? formatTime(d.printEstimation.printTimeHours) : '-' },
      { name: '材料重量(g)', value: (d: ReportData) => d.printEstimation?.materialWeight.toFixed(2) || '-' },
      { name: '总成本(元)', value: (d: ReportData) => d.printEstimation?.totalCost.toFixed(2) || '-' },
      { name: '约束通过率', value: (d: ReportData) => {
        const passed = d.constraintChecks.filter(c => c.passed).length;
        return `${passed}/${d.constraintChecks.length} (${((passed / d.constraintChecks.length) * 100).toFixed(0)}%)`;
      }},
      { name: '状态', value: (d: ReportData) => this.getStatusText(d.task.status) }
    ];

    const colWidth = 280 / (data.tasks.length + 1);
    const startX = 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    headers.forEach((header, i) => {
      doc.text(header, startX + i * colWidth + 2, y);
    });
    y += 6;

    doc.setFont('helvetica', 'normal');
    for (const metric of metrics) {
      doc.text(metric.name, startX + 2, y);
      data.tasks.forEach((d, i) => {
        doc.text(String(metric.value(d)), startX + (i + 1) * colWidth + 2, y);
      });
      y += 6;

      if (y > 180) {
        doc.addPage();
        y = 20;
      }
    }

    return doc.output('blob');
  }

  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private static getAlgorithmName(algorithm: string): string {
    const names: Record<string, string> = {
      'quadric_edge_collapse': '二次误差边折叠',
      'clustering': '聚类简化',
      'vertex_clustering': '顶点聚类',
      'meshdecimator': '网格抽取'
    };
    return names[algorithm] || algorithm;
  }

  private static getStatusText(status: string): string {
    const texts: Record<string, string> = {
      'pending': '处理中',
      'completed': '已完成',
      'failed': '失败',
      'duplicate': '重复任务'
    };
    return texts[status] || status;
  }

  private static getErrorTypeText(type: string): string {
    const texts: Record<string, string> = {
      'normal_flip': '法线翻转',
      'hole': '孔洞',
      'error_scale': '误差尺度',
      'degenerate_face': '退化面',
      'non_manifold': '非流形',
      'other': '其他'
    };
    return texts[type] || type;
  }

  private static sanitizeForJSON(data: ReportData): unknown {
    return {
      task: {
        ...data.task,
        createdAt: new Date(data.task.createdAt).toISOString()
      },
      errorAnalysis: data.errorAnalysis ? {
        ...data.errorAnalysis,
        errorDistribution: data.errorAnalysis.errorDistribution
      } : undefined,
      printEstimation: data.printEstimation,
      constraintChecks: data.constraintChecks,
      material: data.material ? {
        ...data.material,
        createdAt: new Date(data.material.createdAt).toISOString(),
        updatedAt: new Date(data.material.updatedAt).toISOString()
      } : undefined,
      qualityErrors: data.qualityErrors
    };
  }

  static generateReportFilename(task: EstimationTask, format: 'pdf' | 'xlsx' | 'json'): string {
    const safeName = task.modelName.replace(/[^\w\u4e00-\u9fa5]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${safeName}_误差分析_${dateStr}.${format}`;
  }

  static generateComparisonFilename(title: string, format: 'pdf' | 'xlsx'): string {
    const safeTitle = title.replace(/[^\w\u4e00-\u9fa5]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${safeTitle}_对比报告_${dateStr}.${format}`;
  }
}

export function generatePlainTextReport(data: ReportData): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('3D打印网格简化误差估计报告');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  lines.push('【任务基本信息】');
  lines.push('-'.repeat(40));
  lines.push(`模型名称: ${data.task.modelName}`);
  lines.push(`原始面数: ${formatNumber(data.task.originalFaces, 0)}`);
  lines.push(`简化后面数: ${formatNumber(data.task.simplifiedFaces, 0)}`);
  lines.push(`简化比例: ${(data.task.simplificationRatio * 100).toFixed(1)}%`);
  lines.push(`简化算法: ${data.task.algorithm}`);
  lines.push(`误差阈值: ${data.task.errorThreshold.toFixed(4)} mm`);
  lines.push(`层厚: ${data.task.layerHeight.toFixed(2)} mm`);
  lines.push(`填充率: ${data.task.infillRate.toFixed(0)}%`);
  lines.push(`材料: ${data.material?.name || '未选择'} (${data.material?.code || '-'})`);
  lines.push('');

  if (data.errorAnalysis) {
    lines.push('【误差分析结果】');
    lines.push('-'.repeat(40));
    lines.push(`最大误差: ${data.errorAnalysis.maxError.toFixed(4)} mm`);
    lines.push(`最小误差: ${data.errorAnalysis.minError.toFixed(4)} mm`);
    lines.push(`平均误差: ${data.errorAnalysis.meanError.toFixed(4)} mm`);
    lines.push(`标准差: ${data.errorAnalysis.stdDeviation.toFixed(4)} mm`);
    lines.push(`模型体积: ${data.errorAnalysis.volume.toFixed(4)} cm³`);
    lines.push(`表面积: ${data.errorAnalysis.surfaceArea.toFixed(4)} cm²`);
    lines.push('');
    lines.push('拓扑质量:');
    lines.push(`  法线一致性: ${data.errorAnalysis.hasNormalFlip ? '✗ 存在翻转' : '✓ 一致'} (${data.errorAnalysis.normalFlipCount} 处)`);
    lines.push(`  模型封闭性: ${data.errorAnalysis.hasHoles ? '⚠ 存在孔洞' : '✓ 封闭'} (${data.errorAnalysis.holeCount} 个)`);
    lines.push('');
  }

  if (data.printEstimation) {
    lines.push('【打印估算结果】');
    lines.push('-'.repeat(40));
    lines.push(`预估打印时间: ${formatTime(data.printEstimation.printTimeHours)}`);
    lines.push(`材料用量: ${data.printEstimation.materialWeight.toFixed(2)} g`);
    lines.push(`材料成本: ¥${data.printEstimation.materialCost.toFixed(2)}`);
    lines.push(`能耗: ${data.printEstimation.energyConsumption.toFixed(2)} kWh`);
    lines.push(`总成本: ¥${data.printEstimation.totalCost.toFixed(2)}`);
    lines.push('');
  }

  if (data.constraintChecks.length > 0) {
    lines.push('【约束检查结果】');
    lines.push('-'.repeat(40));
    for (const check of data.constraintChecks) {
      const status = check.passed ? '✓' : '✗';
      const severity = `[${check.severity.toUpperCase()}]`;
      lines.push(`${status} ${severity} ${check.constraintName}: ${check.details}`);
    }
    lines.push('');
  }

  if (data.qualityErrors.length > 0) {
    lines.push('【详细问题列表】');
    lines.push('-'.repeat(40));
    for (let i = 0; i < Math.min(data.qualityErrors.length, 50); i++) {
      const error = data.qualityErrors[i];
      const severity = `[${error.severity.toUpperCase()}]`;
      const type = error.type;
      let msg = `${i + 1}. ${severity} [${type}] ${error.message}`;
      if (error.faceIndex !== undefined) msg += ` (面: ${error.faceIndex})`;
      if (error.location) {
        msg += ` 位置: (${error.location[0].toFixed(3)}, ${error.location[1].toFixed(3)}, ${error.location[2].toFixed(3)})`;
      }
      lines.push(msg);
    }
    if (data.qualityErrors.length > 50) {
      lines.push(`... 还有 ${data.qualityErrors.length - 50} 条问题未显示`);
    }
  }

  return lines.join('\n');
}
