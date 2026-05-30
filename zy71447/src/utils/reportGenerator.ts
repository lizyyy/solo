import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type {
  ReportBatch,
  RiskItem,
  InstrumentName,
  InstrumentModel,
  SectionParams,
  BandType,
} from '@/types';
import { RISK_TYPE_LABELS, BAND_CONFIGS } from '@/types';

export class ReportGenerator {
  static generateFileName(date: string, batchNo: string, instrumentType: InstrumentName): string {
    return `乐器声学剖面报告_批次${date}_${batchNo}_${instrumentType}.pdf`;
  }

  static generateBatchNo(sequence: number): string {
    return `${sequence.toString().padStart(2, '0')}`;
  }

  static getCurrentDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  static createReportBatch(
    instrument: InstrumentModel,
    risks: RiskItem[],
    sectionParams: SectionParams,
    currentBand: BandType,
    batchSequence: number,
    reviewer: string = '未指定'
  ): ReportBatch {
    const date = this.getCurrentDateString();
    const batchNo = this.generateBatchNo(batchSequence);

    return {
      id: `batch-${date}-${batchNo}`,
      batchNo,
      date,
      instrumentType: instrument.name,
      risks,
      generatedAt: new Date().toISOString(),
      dataVersion: instrument.dataVersion,
      fileName: this.generateFileName(date, batchNo, instrument.name),
      reviewer,
    };
  }

  static buildReportContent(batch: ReportBatch): string {
    const bandConfig = BAND_CONFIGS.find((b) => b.key === 'mid')!;

    const riskByType: Record<string, RiskItem[]> = {
      section_occlusion: [],
      band_mismatch: [],
      hotspot_missing: [],
    };

    batch.risks.forEach((r) => {
      riskByType[r.type].push(r);
    });

    const formatDateTime = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    let content = `
═══════════════════════════════════════════════
           乐器博物馆声学剖面报告
═══════════════════════════════════════════════

【批次信息】
批次号：${batch.date}_${batch.batchNo}
乐器类型：${batch.instrumentType}
生成时间：${formatDateTime(batch.generatedAt)}
数据版本：${batch.dataVersion}
评审人员：${batch.reviewer}

【频段标准参照】
低频：${bandConfig.minFreq}-${bandConfig.maxFreq}Hz
中频：${BAND_CONFIGS[1].minFreq}-${BAND_CONFIGS[1].maxFreq}Hz
高频：${BAND_CONFIGS[2].minFreq}-${BAND_CONFIGS[2].maxFreq}Hz

═══════════════════════════════════════════════
                风险检测汇总
═══════════════════════════════════════════════

`;

    const riskTypes: Array<keyof typeof riskByType> = [
      'section_occlusion',
      'band_mismatch',
      'hotspot_missing',
    ];

    riskTypes.forEach((type) => {
      const risks = riskByType[type];
      const label = RISK_TYPE_LABELS[type];

      content += `\n【${label}风险】\n`;
      content += `检测数量：${risks.length} 项\n`;

      if (risks.length === 0) {
        content += '状态：正常，未检测到风险\n';
      } else {
        risks.forEach((risk, idx) => {
          content += `\n  ${idx + 1}. 严重程度：${this.getSeverityText(risk.severity)}\n`;
          content += `     描述：${risk.description}\n`;
          content += `     业务解释：${risk.businessInterpretation}\n`;
          content += `     检测时间：${formatDateTime(risk.detectedAt)}\n`;
          content += `     原始数据快照：\n`;
          content += `       ${JSON.stringify(risk.rawDataSnapshot, null, 2).replace(/\n/g, '\n       ')}\n`;
        });
      }
    });

    content += `
═══════════════════════════════════════════════
                  数据追溯
═══════════════════════════════════════════════

本报告所有风险检测均基于原始输入数据进行，
未对业务同事提供的数据口径做任何修改。
如需追溯原始数据，请参考各风险项的「原始数据快照」。

═══════════════════════════════════════════════
`;

    return content;
  }

  private static getSeverityText(severity: string): string {
    const map: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
    };
    return map[severity] || severity;
  }

  static async exportToPdf(batch: ReportBatch, elementId?: string): Promise<Blob> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    if (elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        const canvas = await html2canvas(element, {
          backgroundColor: '#121212',
          scale: 2,
        });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 190;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        doc.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      }
    }

    const content = this.buildReportContent(batch);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;

    doc.setFont('courier', 'normal');
    doc.setFontSize(10);

    const lines = doc.splitTextToSize(content, maxWidth);
    let yPosition = elementId ? 120 : margin;
    const lineHeight = 4.5;

    lines.forEach((line: string) => {
      if (yPosition + lineHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      if (line.includes('══════')) {
        doc.setTextColor(184, 134, 11);
      } else if (line.includes('【') && line.includes('】')) {
        doc.setTextColor(218, 165, 32);
      } else {
        doc.setTextColor(50, 50, 50);
      }

      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    });

    return doc.output('blob');
  }

  static downloadReport(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async generateAndDownload(
    batch: ReportBatch,
    elementId?: string
  ): Promise<void> {
    const blob = await this.exportToPdf(batch, elementId);
    this.downloadReport(blob, batch.fileName);
  }
}
