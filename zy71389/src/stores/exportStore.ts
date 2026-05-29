import { create } from 'zustand';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  ExposureLog,
  ConversionData,
  CheckResult,
  ContaminationType,
  CONTAMINATION_TYPE_LABELS,
  LogEntry,
  ExportFormat,
  ExportContent,
  ConsistencyReport,
  PhaseResult
} from '../types';
import { ConsistencyCheckEngine } from '../engines/ConsistencyCheckEngine';
import { MetricRecalculationEngine } from '../engines/MetricRecalculationEngine';
import { FileParserEngine } from '../engines/FileParserEngine';

export interface ExportRecord {
  id: string;
  format: ExportFormat;
  content: ExportContent;
  filename: string;
  timestamp: number;
  recordCount: number;
  checksum: string;
}

interface ExportState {
  isExporting: boolean;
  exportProgress: number;
  currentExportStep: string;
  currentProgress: number;
  lastExportTime: number | null;
  logs: LogEntry[];
  exportHistory: ExportRecord[];
  
  exportData: (
    format: ExportFormat,
    content: ExportContent,
    exposures: ExposureLog[],
    conversions: ConversionData[],
    checkResult: CheckResult | null
  ) => Promise<void>;
  
  exportReport: (
    elementId: string,
    checkResult: CheckResult | null
  ) => Promise<void>;
  
  generateExportRows: (
    exposures: ExposureLog[],
    conversions: ConversionData[],
    content: ExportContent,
    checkResult?: CheckResult | null
  ) => Record<string, any>[];
  
  addLog: (log: LogEntry) => void;
  reset: () => void;
  clearHistory: () => void;
  removeExportRecord: (id: string) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const useExportStore = create<ExportState>((set, get) => ({
  isExporting: false,
  exportProgress: 0,
  currentExportStep: '',
  currentProgress: 0,
  lastExportTime: null,
  logs: [],
  exportHistory: [],
  
  addLog: (log) => set((state) => ({
    logs: [...state.logs, log].slice(-100)
  })),
  
  reset: () => set({
    isExporting: false,
    exportProgress: 0,
    currentExportStep: '',
    currentProgress: 0,
    logs: []
  }),
  
  clearHistory: () => set({ exportHistory: [] }),
  
  removeExportRecord: (id) => set((state) => ({
    exportHistory: state.exportHistory.filter(r => r.id !== id)
  })),
  
  generateExportRows: (exposures, conversions, content, checkResult) => {
    let filteredExposures = exposures;
    
    if (content === 'contaminated' || content === 'contamination_detail') {
      filteredExposures = exposures.filter(e => e.isContaminated);
    } else if (content === 'normal') {
      filteredExposures = exposures.filter(e => !e.isContaminated);
    } else if (content === 'summary' && checkResult) {
      return [
        { 统计项: '总曝光量', 数值: checkResult.totalExposures },
        { 统计项: '污染记录数', 数值: checkResult.contaminatedCount },
        { 统计项: '污染率', 数值: `${(checkResult.contaminationRate * 100).toFixed(2)}%` },
        { 统计项: '串组污染数', 数值: checkResult.crossGroupCount },
        { 统计项: '重复曝光数', 数值: checkResult.duplicateExposureCount },
        { 统计项: '配置变更污染数', 数值: checkResult.configChangeCount },
        { 统计项: '原始转化率', 数值: `${(checkResult.originalMetrics.conversionRate * 100).toFixed(4)}%` },
        { 统计项: '修正转化率', 数值: `${(checkResult.recalculatedMetrics.conversionRate * 100).toFixed(4)}%` },
        { 统计项: '数据校验和', 数值: checkResult.consistencyChecksum }
      ];
    } else if (content === 'phase_metrics' && checkResult) {
      return checkResult.phaseResults.map(phase => ({
        阶段: phase.phaseName,
        开始时间: new Date(phase.startTime).toLocaleString(),
        结束时间: new Date(phase.endTime).toLocaleString(),
        配置版本: phase.configVersion,
        曝光数: phase.exposureCount,
        污染数: phase.contaminationCount,
        转化率: `${(phase.metrics.conversionRate * 100).toFixed(4)}%`,
        平均转化值: phase.metrics.averageValue.toFixed(4)
      }));
    } else if (content === 'group_metrics' && checkResult) {
      const groupIds = [...new Set(filteredExposures.map(e => e.groupId))];
      return groupIds.map(groupId => {
        const metrics = MetricRecalculationEngine.calculateGroupMetrics(
          groupId,
          filteredExposures,
          conversions,
          true
        );
        return {
          分组ID: groupId,
          曝光数: metrics.uniqueUsers,
          转化数: metrics.totalConversions,
          转化率: `${(metrics.conversionRate * 100).toFixed(4)}%`,
          平均转化值: metrics.averageValue.toFixed(4),
          总转化值: metrics.totalValue
        };
      });
    } else if (content === 'consistency_report' && checkResult) {
      const report = ConsistencyCheckEngine.performConsistencyCheck(
        exposures,
        conversions,
        checkResult
      );
      return report.details.map(d => ({
        校验项: d.name,
        期望值: d.expected,
        实际值: d.actual,
        差异: d.diff,
        是否匹配: d.match ? '是' : '否'
      }));
    }
    
    return filteredExposures
      .sort((a, b) => b.exposureTime - a.exposureTime)
      .map(exposure => ConsistencyCheckEngine.generateTableRow(exposure, conversions));
  },
  
  exportData: async (format, content, exposures, conversions, checkResult) => {
    const { addLog, generateExportRows } = get();
    
    if (!checkResult) {
      addLog(FileParserEngine.createLogEntry(
        'error',
        '导出失败',
        '请先执行污染检查'
      ));
      return;
    }
    
    const timestamp = Date.now();
    const formatLabel = format === 'xlsx' ? 'excel' : format;
    
    set({
      isExporting: true,
      exportProgress: 0,
      currentProgress: 0,
      currentExportStep: '准备导出数据'
    });
    
    addLog(FileParserEngine.createLogEntry(
      'info',
      `开始导出数据`,
      `格式: ${format}, 内容: ${content}`
    ));
    
    await sleep(200);
    
    try {
      set({ exportProgress: 20, currentProgress: 20, currentExportStep: '生成导出数据' });
      
      const rows = generateExportRows(exposures, conversions, content, checkResult);
      
      set({ exportProgress: 40, currentProgress: 40, currentExportStep: '执行一致性校验' });
      
      const verification = ConsistencyCheckEngine.verifyExportData(
        rows,
        content === 'all' || content === 'contamination_detail' ? exposures : 
        content === 'contaminated' ? exposures.filter(e => e.isContaminated) :
        exposures.filter(e => !e.isContaminated),
        conversions
      );
      
      if (!verification.valid) {
        addLog(FileParserEngine.createLogEntry(
          'warn',
          '数据一致性校验发现问题',
          verification.errors.slice(0, 3).join('; ')
        ));
      }
      
      await sleep(200);
      
      set({ exportProgress: 60, currentProgress: 60, currentExportStep: `生成${formatLabel.toUpperCase()}文件` });
      
      let filename = '';
      
      if (format === 'csv' || format === 'excel' || format === 'xlsx') {
        const ext = format === 'csv' ? 'csv' : 'xlsx';
        filename = `污染检查结果_${timestamp}.${ext}`;
        
        if (format === 'csv') {
          const csvContent = [
            Object.keys(rows[0] || {}).join(','),
            ...rows.map(row => Object.values(row).map(v => 
              typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v
            ).join(','))
          ].join('\n');
          
          const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          link.click();
          URL.revokeObjectURL(link.href);
        } else {
        const wb = XLSX.utils.book_new();
        
        const dataSheet = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, dataSheet, '详细数据');
        
        if (checkResult) {
          const summaryData = [
            ['污染检查汇总报告'],
            [''],
            ['统计项', '数值'],
            ['总曝光量', checkResult.totalExposures],
            ['污染记录数', checkResult.contaminatedCount],
            ['污染率', `${(checkResult.contaminationRate * 100).toFixed(2)}%`],
            ['串组污染数', checkResult.crossGroupCount],
            ['重复曝光数', checkResult.duplicateExposureCount],
            ['配置变更污染数', checkResult.configChangeCount],
            [''],
            ['原始指标'],
            ['转化率', `${(checkResult.originalMetrics.conversionRate * 100).toFixed(4)}%`],
            ['平均转化值', checkResult.originalMetrics.averageValue.toFixed(4)],
            ['总转化数', checkResult.originalMetrics.totalConversions],
            ['总转化值', checkResult.originalMetrics.totalValue],
            ['独立用户数', checkResult.originalMetrics.uniqueUsers],
            [''],
            ['修正指标（去污染后）'],
            ['转化率', `${(checkResult.recalculatedMetrics.conversionRate * 100).toFixed(4)}%`],
            ['平均转化值', checkResult.recalculatedMetrics.averageValue.toFixed(4)],
            ['总转化数', checkResult.recalculatedMetrics.totalConversions],
            ['总转化值', checkResult.recalculatedMetrics.totalValue],
            ['独立用户数', checkResult.recalculatedMetrics.uniqueUsers],
            [''],
            ['一致性校验'],
            ['数据校验和', checkResult.consistencyChecksum],
            ['导出校验结果', verification.valid ? '通过' : '存在差异'],
            ['导出时间', new Date().toLocaleString()]
          ];
          
          const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
          XLSX.utils.book_append_sheet(wb, summarySheet, '汇总报告');
          
          if (checkResult.phaseResults.length > 0) {
            const phaseData = [
              ['阶段分析'],
              [''],
              ['阶段', '开始时间', '结束时间', '配置版本', '曝光数', '污染数', '转化率', '平均转化值']
            ];
            
            checkResult.phaseResults.forEach(phase => {
              phaseData.push([
                phase.phaseName,
                new Date(phase.startTime).toLocaleString(),
                new Date(phase.endTime).toLocaleString(),
                phase.configVersion,
                String(phase.exposureCount),
                String(phase.contaminationCount),
                `${(phase.metrics.conversionRate * 100).toFixed(4)}%`,
                phase.metrics.averageValue.toFixed(4)
              ]);
            });
            
            const phaseSheet = XLSX.utils.aoa_to_sheet(phaseData);
            XLSX.utils.book_append_sheet(wb, phaseSheet, '阶段分析');
          }
        }
        
          XLSX.writeFile(wb, filename);
        }
      } else if (format === 'json') {
        filename = `污染检查结果_${timestamp}.json`;
        const jsonContent = JSON.stringify({
          exportMetadata: {
            timestamp,
            format,
            content,
            checksum: checkResult.consistencyChecksum,
            verification: verification.valid ? 'PASS' : 'FAIL'
          },
          checkResult,
          data: rows
        }, null, 2);
        
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
      } else if (format === 'pdf') {
        filename = `污染检查报告_${timestamp}.pdf`;
        const element = document.getElementById('report-content');
        if (!element) {
          throw new Error('未找到报告内容元素');
        }
        
        set({ exportProgress: 70, currentProgress: 70, currentExportStep: '截图页面内容' });
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
        
        set({ exportProgress: 85, currentProgress: 85, currentExportStep: '生成PDF文件' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 20;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 10;
        
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 20);
        
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight + 10;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
          heightLeft -= (pageHeight - 20);
        }
        
        pdf.save(filename);
      }
      
      set({ exportProgress: 100, currentProgress: 100, currentExportStep: '导出完成' });
      
      addLog(FileParserEngine.createLogEntry(
        'success',
        '数据导出完成',
        `共导出 ${rows.length} 条记录, 校验: ${verification.valid ? '通过' : '存在差异'}`
      ));
      
      const record: ExportRecord = {
        id: FileParserEngine.generateId(),
        format,
        content,
        filename,
        timestamp,
        recordCount: rows.length,
        checksum: checkResult.consistencyChecksum
      };
      
      set((state) => ({
        isExporting: false,
        lastExportTime: timestamp,
        exportHistory: [record, ...state.exportHistory].slice(0, 50)
      }));
      
    } catch (error) {
      set({ isExporting: false, currentProgress: 0 });
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      addLog(FileParserEngine.createLogEntry(
        'error',
        '导出失败',
        errorMessage
      ));
      
      throw error;
    }
  },
  
  exportReport: async (elementId, checkResult) => {
    const { addLog } = get();
    
    if (!checkResult) {
      addLog(FileParserEngine.createLogEntry(
        'error',
        '导出失败',
        '请先执行污染检查'
      ));
      return;
    }
    
    const timestamp = Date.now();
    const filename = `污染检查报告_${timestamp}.pdf`;
    
    set({
      isExporting: true,
      exportProgress: 0,
      currentProgress: 0,
      currentExportStep: '准备导出报告'
    });
    
    addLog(FileParserEngine.createLogEntry(
      'info',
      '开始生成PDF报告'
    ));
    
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`未找到元素: ${elementId}`);
      }
      
      set({ exportProgress: 30, currentProgress: 30, currentExportStep: '截图页面内容' });
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      set({ exportProgress: 60, currentProgress: 60, currentExportStep: '生成PDF文件' });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 10;
      
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 20);
      }
      
      pdf.save(filename);
      
      set({ exportProgress: 100, currentProgress: 100, currentExportStep: '报告生成完成' });
      
      addLog(FileParserEngine.createLogEntry(
        'success',
        'PDF报告导出完成',
        `校验和: ${checkResult.consistencyChecksum}`
      ));
      
      const record: ExportRecord = {
        id: FileParserEngine.generateId(),
        format: 'pdf',
        content: 'summary',
        filename,
        timestamp,
        recordCount: 1,
        checksum: checkResult.consistencyChecksum
      };
      
      set((state) => ({
        isExporting: false,
        lastExportTime: timestamp,
        exportHistory: [record, ...state.exportHistory].slice(0, 50)
      }));
      
    } catch (error) {
      set({ isExporting: false, currentProgress: 0 });
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      addLog(FileParserEngine.createLogEntry(
        'error',
        'PDF报告导出失败',
        errorMessage
      ));
      
      throw error;
    }
  }
}));
