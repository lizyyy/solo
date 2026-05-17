import { DefectDAO } from '../dao/DefectDAO';
import { Defect, DefectStatus } from '../models/types';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { Writable } from 'stream';

const defectDAO = new DefectDAO();

export class ExportService {
  async exportToCSV(procurementOrderNo?: string): Promise<string> {
    const defects = await defectDAO.getAll({ procurementOrderNo });

    const fields = [
      { label: '缺陷ID', value: 'id' },
      { label: '采购单号', value: 'procurementOrderNo' },
      { label: '设备编号', value: 'equipmentNo' },
      { label: '缺陷类型', value: 'defectType' },
      { label: '缺陷描述', value: 'description' },
      { label: '状态', value: 'status' },
      { label: '检验员', value: 'inspector' },
      { label: '登记时间', value: (row: Defect) => row.registeredAt.toISOString() },
      { label: '是否逾期', value: (row: Defect) => row.isOverdue ? '是' : '否' },
      { label: '整改要求', value: (row: Defect) => row.rectification?.content || '' },
      { label: '整改期限', value: (row: Defect) => row.rectification?.deadline.toISOString() || '' }
    ];

    const parser = new Parser({ fields });
    return parser.parse(defects);
  }

  async exportToPDF(procurementOrderNo: string): Promise<Buffer> {
    const defects = await defectDAO.getAll({ procurementOrderNo });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(20).text('采购验收缺陷报告', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).text(`采购单号: ${procurementOrderNo}`);
      doc.text(`生成时间: ${new Date().toLocaleString()}`);
      doc.text(`总缺陷数: ${defects.length}`);
      doc.text(`已通过: ${defects.filter(d => d.status === DefectStatus.PASSED).length}`);
      doc.text(`待处理: ${defects.filter(d => d.status !== DefectStatus.PASSED && d.status !== DefectStatus.CLOSED).length}`);
      doc.moveDown();

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      defects.forEach((defect, index) => {
        doc.fontSize(14).text(`缺陷 ${index + 1}`, { underline: true });
        doc.fontSize(10);
        doc.text(`设备编号: ${defect.equipmentNo}`);
        doc.text(`缺陷类型: ${defect.defectType}`);
        doc.text(`状态: ${defect.status}`);
        doc.text(`描述: ${defect.description}`);
        doc.text(`检验员: ${defect.inspector}`);
        doc.text(`登记时间: ${defect.registeredAt.toLocaleString()}`);

        if (defect.rectification) {
          doc.text(`整改要求: ${defect.rectification.content}`);
          doc.text(`整改期限: ${defect.rectification.deadline.toLocaleString()}`);
        }

        if (defect.reinspections.length > 0) {
          doc.text(`复验次数: ${defect.reinspections.length}`);
        }

        doc.moveDown();
        if (index < defects.length - 1) {
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown();
        }
      });

      doc.end();
    });
  }
}
