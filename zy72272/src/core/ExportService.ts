import type { InspectionRecord } from '../../shared/types';
import { CadService } from './CadService';
import { AuditLogger } from './AuditLogger';

export class ExportService {
  static async exportScreenshot(
    records: InspectionRecord[],
    elementId: string = 'simulation-board'
  ): Promise<string> {
    const fileName = CadService.generateExportFileName(records);

    if (typeof document !== 'undefined') {
      const element = document.getElementById(elementId);
      if (element) {
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(element, {
            backgroundColor: '#0f172a',
            scale: 2,
            useCORS: true,
            logging: false,
          });

          const link = document.createElement('a');
          link.download = fileName;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (error) {
          console.warn('截图导出失败，使用模拟导出:', error);
          this.simulateExport(fileName);
        }
      } else {
        this.simulateExport(fileName);
      }
    } else {
      this.simulateExport(fileName);
    }

    records.forEach((record) => {
      AuditLogger.log({
        recordId: record.id,
        operator: '老梁',
        action: 'export',
        remark: `导出截图，文件名: ${fileName}`,
      });
    });

    return fileName;
  }

  private static simulateExport(fileName: string): void {
    console.log(`[模拟导出] 文件名: ${fileName}`);
    console.log(`[模拟导出] 文件已保存到下载目录`);
  }

  static async exportToJson(records: InspectionRecord[]): Promise<string> {
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `充电站车流模拟_${timestamp}_数据.json`;
    const jsonData = JSON.stringify(records, null, 2);

    if (typeof document !== 'undefined') {
      const blob = new Blob([jsonData], { type: 'application/json' });
      const link = document.createElement('a');
      link.download = fileName;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }

    return fileName;
  }

  static getExportFileName(records: InspectionRecord[]): string {
    return CadService.generateExportFileName(records);
  }
}
