import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { TensionRecord, Customer, Instrument, ERROR_TYPE_LABELS, RISK_LEVEL_LABELS } from '../types';
import { formatDate } from './tension';

export function exportToPDF(
  records: TensionRecord[],
  customers: Customer[],
  instruments: Instrument[],
  title: string = '琴弦张力预警报告'
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`生成时间: ${formatDate(new Date())}`, 14, yPos);
  yPos += 10;
  doc.text(`记录总数: ${records.length}`, 14, yPos);
  yPos += 15;

  records.forEach((record, index) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    const instrument = instruments.find((i) => i.id === record.instrumentId);
    const customer = customers.find((c) => c.id === instrument?.customerId);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`记录 ${index + 1}: 第${record.stringNumber}弦 - ${record.stringSpec}`, 14, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    if (customer) {
      doc.text(`客户: ${customer.name}`, 14, yPos);
      yPos += 6;
    }
    if (instrument) {
      doc.text(`乐器: ${instrument.brand} ${instrument.model}`, 14, yPos);
      yPos += 6;
    }

    doc.text(`音高: ${record.pitch} | 弦长: ${record.stringLength}${record.lengthUnit}`, 14, yPos);
    yPos += 6;

    doc.text(`原始张力: ${record.original.tension.toFixed(2)}N | 风险等级: ${RISK_LEVEL_LABELS[record.original.riskLevel]}`, 14, yPos);
    yPos += 6;

    if (record.corrected) {
      doc.text(`修正张力: ${record.corrected.tension.toFixed(2)}N | 风险等级: ${RISK_LEVEL_LABELS[record.corrected.riskLevel]}`, 14, yPos);
      yPos += 6;
    }

    doc.text(`最终结论: ${record.final.conclusion}`, 14, yPos);
    yPos += 6;

    if (record.errorTags.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('错误标记:', 14, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      record.errorTags.forEach((tag) => {
        const status = tag.resolved ? '[已解决]' : '[未解决]';
        doc.text(`  ${status} ${ERROR_TYPE_LABELS[tag.type]}: ${tag.description}`, 14, yPos);
        yPos += 5;
      });
    }

    if (record.notes) {
      doc.text(`备注: ${record.notes}`, 14, yPos);
      yPos += 6;
    }

    doc.text(`创建时间: ${formatDate(record.createdAt)}`, 14, yPos);
    yPos += 12;

    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 10;
  });

  doc.save(`琴弦张力报告_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportToExcel(
  records: TensionRecord[],
  customers: Customer[],
  instruments: Instrument[]
): void {
  const wb = XLSX.utils.book_new();

  const recordData = records.map((record) => {
    const instrument = instruments.find((i) => i.id === record.instrumentId);
    const customer = customers.find((c) => c.id === instrument?.customerId);

    return {
      '记录ID': record.id,
      '客户名称': customer?.name || '',
      '联系电话': customer?.phone || '',
      '乐器类型': instrument?.type || '',
      '品牌型号': instrument ? `${instrument.brand} ${instrument.model}` : '',
      '弦号': record.stringNumber,
      '琴弦规格': record.stringSpec,
      '音高': record.pitch,
      '弦长': record.stringLength,
      '单位': record.lengthUnit,
      '原始张力(N)': record.original.tension.toFixed(2),
      '原始风险等级': RISK_LEVEL_LABELS[record.original.riskLevel],
      '修正张力(N)': record.corrected?.tension.toFixed(2) || '',
      '修正风险等级': record.corrected ? RISK_LEVEL_LABELS[record.corrected.riskLevel] : '',
      '最终张力(N)': record.final.tension.toFixed(2),
      '最终风险等级': RISK_LEVEL_LABELS[record.final.riskLevel],
      '最终结论': record.final.conclusion,
      '错误标记': record.errorTags.map((t) => `${ERROR_TYPE_LABELS[t.type]}${t.resolved ? '(已解决)' : ''}`).join('; '),
      '有未解决标记': record.errorTags.some((t) => !t.resolved) ? '是' : '否',
      '备注': record.notes,
      '创建时间': formatDate(record.createdAt),
      '更新时间': formatDate(record.updatedAt),
    };
  });

  const ws1 = XLSX.utils.json_to_sheet(recordData);
  XLSX.utils.book_append_sheet(wb, ws1, '张力记录');

  const customerData = customers.map((c) => ({
    '客户ID': c.id,
    '客户名称': c.name,
    '联系电话': c.phone,
    '备注': c.notes,
    '创建时间': formatDate(c.createdAt),
  }));
  const ws2 = XLSX.utils.json_to_sheet(customerData);
  XLSX.utils.book_append_sheet(wb, ws2, '客户信息');

  const instrumentData = instruments.map((i) => {
    const customer = customers.find((c) => c.id === i.customerId);
    return {
      '乐器ID': i.id,
      '所属客户': customer?.name || '',
      '乐器类型': i.type,
      '品牌': i.brand,
      '型号': i.model,
      '序列号': i.serialNumber,
      '弦数': i.stringCount,
    };
  });
  const ws3 = XLSX.utils.json_to_sheet(instrumentData);
  XLSX.utils.book_append_sheet(wb, ws3, '乐器信息');

  XLSX.writeFile(wb, `琴弦张力数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
