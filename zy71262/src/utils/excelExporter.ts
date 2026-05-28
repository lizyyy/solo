import * as XLSX from 'xlsx';
import { Pigment, ANOMALY_LABELS, STATUS_LABELS } from '../types';

interface ExportOptions {
  includeFormulas?: boolean;
  includeNotes?: boolean;
}

export function exportPigmentsToExcel(
  pigments: Pigment[],
  filename: string = '色料配方报告.xlsx',
  options: ExportOptions = {}
): void {
  const { includeFormulas = true, includeNotes = true } = options;

  const processed = pigments.filter(p => p.status === 'processed');
  const pending = pigments.filter(p => p.status === 'pending');
  const rejected = pigments.filter(p => p.status === 'rejected');

  const wb = XLSX.utils.book_new();

  const mainData = pigments.map(p => ({
    '色料编号': p.code,
    '色料名称': p.name,
    '颜色值': p.colorHex,
    '透明度': `${(p.transparency * 100).toFixed(0)}%`,
    '耐光等级': p.lightfastness ?? '未测',
    '成本': p.cost,
    '状态': STATUS_LABELS[p.status],
    '异常标记': p.anomalies.map(a => ANOMALY_LABELS[a]).join('; ') || '无',
    ...(includeNotes && p.notes ? { '备注': p.notes } : {}),
  }));

  const mainSheet = XLSX.utils.json_to_sheet(mainData);
  XLSX.utils.book_append_sheet(wb, mainSheet, '全部色料');

  if (processed.length > 0) {
    const processedSheet = XLSX.utils.json_to_sheet(processed.map(p => ({
      '色料编号': p.code,
      '色料名称': p.name,
      '透明度': `${(p.transparency * 100).toFixed(0)}%`,
      '耐光等级': p.lightfastness,
      '成本': p.cost,
      ...(includeNotes && p.notes ? { '备注': p.notes } : {}),
    })));
    XLSX.utils.book_append_sheet(wb, processedSheet, '已处理');
  }

  if (pending.length > 0) {
    const pendingSheet = XLSX.utils.json_to_sheet(pending.map(p => ({
      '色料编号': p.code,
      '色料名称': p.name,
      '异常类型': p.anomalies.map(a => ANOMALY_LABELS[a]).join('; '),
      '透明度': `${(p.transparency * 100).toFixed(0)}%`,
      '耐光等级': p.lightfastness ?? '未测',
      '成本': p.cost,
      ...(includeNotes && p.notes ? { '备注': p.notes } : {}),
    })));
    XLSX.utils.book_append_sheet(wb, pendingSheet, '待确认');
  }

  if (rejected.length > 0) {
    const rejectedSheet = XLSX.utils.json_to_sheet(rejected.map(p => ({
      '色料编号': p.code,
      '色料名称': p.name,
      '退回原因': p.anomalies.map(a => ANOMALY_LABELS[a]).join('; '),
      '透明度': `${(p.transparency * 100).toFixed(0)}%`,
      '耐光等级': p.lightfastness ?? '未测',
      '成本': p.cost,
      ...(includeNotes && p.notes ? { '备注': p.notes } : {}),
    })));
    XLSX.utils.book_append_sheet(wb, rejectedSheet, '需退回');
  }

  if (includeFormulas) {
    const formulaData = pigments.flatMap(p => 
      p.formula.map(f => ({
        '色料编号': p.code,
        '色料名称': p.name,
        '成分名称': f.componentName,
        '比例(%)': f.ratio,
      }))
    );
    const formulaSheet = XLSX.utils.json_to_sheet(formulaData);
    XLSX.utils.book_append_sheet(wb, formulaSheet, '配方明细');
  }

  const summaryData = [
    { '统计项': '色料总数', '数量': pigments.length },
    { '统计项': '已处理', '数量': processed.length },
    { '统计项': '待确认', '数量': pending.length },
    { '统计项': '需退回', '数量': rejected.length },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, '统计汇总');

  XLSX.writeFile(wb, filename);
}

export function importPigmentsFromExcel(file: File): Promise<Pigment[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        resolve(jsonData as Pigment[]);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}
