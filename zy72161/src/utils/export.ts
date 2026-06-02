import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { ShelterPoint, ProcessRecord, shelterStatusLabels } from '../types';

export async function exportToPDF(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
  const imgX = (pdfWidth - imgWidth * ratio) / 2;
  const imgY = 10;

  pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
  pdf.save(`${filename}.pdf`);
}

export function exportToExcel(
  shelters: ShelterPoint[],
  records: ProcessRecord[],
  filename: string
): void {
  const shelterData = shelters.map(s => ({
    '点位名称': s.standardName,
    '别名': s.aliases.join(' / '),
    '设计容量': s.designCapacity,
    '反馈人数': s.reportedCount,
    '容量利用率': `${Math.round((s.reportedCount / s.designCapacity) * 100)}%`,
    '状态': shelterStatusLabels[s.status],
    '冲突类型': s.conflictType,
    '经度': s.longitude,
    '纬度': s.latitude,
    '自然语言解读': s.naturalLanguageResult,
    '更新时间': s.updatedAt
  }));

  const recordData = records.map(r => ({
    '点位名称': shelters.find(s => s.id === r.shelterId)?.standardName || '',
    '操作人': r.operator,
    '操作时间': r.operateTime,
    '操作类型': r.action,
    '原状态': r.oldStatus ? shelterStatusLabels[r.oldStatus] : '-',
    '新状态': shelterStatusLabels[r.newStatus],
    '处理备注': r.remark,
    '补充材料': r.supplementMaterial || '-'
  }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(shelterData);
  const ws2 = XLSX.utils.json_to_sheet(recordData);

  XLSX.utils.book_append_sheet(wb, ws1, '点位清单');
  XLSX.utils.book_append_sheet(wb, ws2, '处理记录');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function printReport(elementId: string): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>应急避难场所容量报告</title>
        <style>
          body { font-family: 'SimSun', serif; padding: 20px; line-height: 1.6; }
          h1 { font-size: 24px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { font-size: 18px; color: #1E40AF; margin-top: 20px; border-left: 4px solid #1E40AF; padding-left: 10px; }
          .section { margin: 15px 0; }
          .summary { background: #f0f4ff; padding: 15px; border-radius: 4px; }
          .point-card { border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; margin: 10px 0; }
          .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; color: white; font-size: 12px; }
          .status-processed { background: #16A34A; }
          .status-pending { background: #F97316; }
          .status-onsite { background: #DC2626; }
          .evidence { background: #f9fafb; padding: 10px; border-left: 3px solid #d1d5db; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
          th { background: #f3f4f6; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
