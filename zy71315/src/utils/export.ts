import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Papa from 'papaparse';
import type { Experiment, ExportOptions, ExportFormat, Peak } from '../types';

export class ExportManager {
  async captureScreenshot(element: HTMLElement): Promise<string> {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0A1628',
      scale: 2,
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL('image/png');
  }

  downloadImage(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  async exportToPNG(
    element: HTMLElement,
    experiment: Experiment,
    options: ExportOptions
  ): Promise<void> {
    const dataUrl = await this.captureScreenshot(element);
    const filename = `${experiment.name.replace(/\s+/g, '_')}_spectrum.png`;
    this.downloadImage(dataUrl, filename);
  }

  async exportToPDF(
    element: HTMLElement,
    experiment: Experiment,
    options: ExportOptions
  ): Promise<void> {
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.setFillColor(10, 22, 40);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    pdf.setTextColor(0, 245, 212);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('音叉共鸣频率分析报告', pageWidth / 2, 15, { align: 'center' });

    pdf.setTextColor(232, 234, 237);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`实验名称: ${experiment.name}`, 15, 25);
    pdf.text(`实验日期: ${new Date(experiment.createdAt).toLocaleString('zh-CN')}`, 15, 32);
    pdf.text(`版本: v${experiment.version}`, 15, 39);
    pdf.text(`状态: ${experiment.status === 'confirmed' ? '已确认' : '临时'}`, 15, 46);

    const yPos = 55;
    pdf.text('实验参数:', 15, yPos);
    pdf.text(`音叉频率: ${experiment.tuningFork.frequency} Hz`, 20, yPos + 7);
    pdf.text(`共鸣箱: ${experiment.resonanceBox.length}x${experiment.resonanceBox.width}x${experiment.resonanceBox.height} cm`, 20, yPos + 14);
    pdf.text(`采样率: ${experiment.sampling.sampleRate} Hz`, 20, yPos + 21);

    if (options.includeSpectrum) {
      const dataUrl = await this.captureScreenshot(element);
      const imgWidth = pageWidth - 30;
      const imgHeight = 80;
      pdf.addImage(dataUrl, 'PNG', 15, 85, imgWidth, imgHeight);
    }

    if (options.includePeaks && experiment.peaks.length > 0) {
      const peaksY = 175;
      pdf.setTextColor(255, 159, 28);
      pdf.text('检测到的峰值:', 15, peaksY);
      
      const validPeaks = experiment.peaks.filter(p => !p.isNoise).slice(0, 5);
      validPeaks.forEach((peak, index) => {
        const rowY = peaksY + 8 + index * 7;
        pdf.setTextColor(232, 234, 237);
        pdf.text(
          `${index + 1}. ${peak.frequency.toFixed(1)} Hz - ${peak.amplitude.toFixed(1)} dB`,
          20,
          rowY
        );
      });
    }

    if (options.includeMetadata && experiment.notes) {
      const notesY = 220;
      pdf.setTextColor(157, 78, 221);
      pdf.text('备注:', 15, notesY);
      pdf.setTextColor(232, 234, 237);
      const splitNotes = pdf.splitTextToSize(experiment.notes, pageWidth - 30);
      pdf.text(splitNotes, 20, notesY + 7);
    }

    const filename = `${experiment.name.replace(/\s+/g, '_')}_report.pdf`;
    pdf.save(filename);
  }

  exportToCSV(experiment: Experiment, options: ExportOptions): void {
    const peaksData = experiment.peaks.map((peak: Peak) => ({
      '频率 (Hz)': peak.frequency.toFixed(2),
      '幅度 (dB)': peak.amplitude.toFixed(2),
      '是否噪声': peak.isNoise ? '是' : '否',
      '状态': peak.status === 'confirmed' ? '已确认' : '临时',
      'Q值': peak.qFactor?.toFixed(2) || '-',
      '标记': peak.marker || '-',
    }));

    const csv = Papa.unparse(peaksData);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${experiment.name.replace(/\s+/g, '_')}_peaks.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportToJSON(experiment: Experiment): void {
    const json = JSON.stringify(experiment, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${experiment.name.replace(/\s+/g, '_')}_data.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async export(
    element: HTMLElement,
    experiment: Experiment,
    options: ExportOptions
  ): Promise<void> {
    switch (options.format) {
      case 'png':
        await this.exportToPNG(element, experiment, options);
        break;
      case 'pdf':
        await this.exportToPDF(element, experiment, options);
        break;
      case 'csv':
        this.exportToCSV(experiment, options);
        break;
      case 'json':
        this.exportToJSON(experiment);
        break;
    }
  }

  generateComparisonReport(
    experiments: Experiment[],
    element: HTMLElement
  ): void {
    if (experiments.length < 2) return;

    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(10, 22, 40);
    pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

    pdf.setTextColor(0, 245, 212);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('实验对比分析报告', pageWidth / 2, 15, { align: 'center' });

    experiments.forEach((exp, index) => {
      const yPos = 30 + index * 35;
      pdf.setTextColor(255, 159, 28);
      pdf.setFontSize(12);
      pdf.text(`实验 ${index + 1}: ${exp.name}`, 15, yPos);
      
      pdf.setTextColor(232, 234, 237);
      pdf.setFontSize(9);
      pdf.text(`音叉: ${exp.tuningFork.frequency} Hz`, 20, yPos + 8);
      pdf.text(`峰值数: ${exp.peaks.filter(p => !p.isNoise).length}`, 80, yPos + 8);
      pdf.text(`版本: v${exp.version}`, 140, yPos + 8);
    });

    const filename = `comparison_report_${Date.now()}.pdf`;
    pdf.save(filename);
  }
}

export const exportManager = new ExportManager();
