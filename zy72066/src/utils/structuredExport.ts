import * as XLSX from 'xlsx';

export interface StructuredReport {
  [key: string]: any;
}

const flattenObject = (obj: any, prefix = ''): any => {
  const result: any = {};
  Object.entries(obj).forEach(([key, value]) => {
    const newKey = prefix ? `${prefix}_${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  });
  return result;
};

export function exportToJSON(report: StructuredReport, fileName: string): void {
  const jsonStr = JSON.stringify(report, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(report: StructuredReport, fileName: string): void {
  const wb = XLSX.utils.book_new();

  if (report.基本信息) {
    const basicData = Object.entries(flattenObject(report.基本信息)).map(([k, v]) => ({
      项目: k,
      值: typeof v === 'string' ? v : JSON.stringify(v),
    }));
    const ws1 = XLSX.utils.json_to_sheet(basicData);
    XLSX.utils.book_append_sheet(wb, ws1, '基本信息');
  }

  if (report.检测参数配置) {
    const configData = Object.entries(report.检测参数配置).map(([k, v]) => ({
      参数名: k,
      参数值: typeof v === 'string' ? v : JSON.stringify(v),
    }));
    const ws2 = XLSX.utils.json_to_sheet(configData);
    XLSX.utils.book_append_sheet(wb, ws2, '检测参数');
  }

  if (report.汇总统计) {
    const summaryData = Object.entries(report.汇总统计).map(([k, v]) => ({
      统计项: k,
      值: typeof v === 'string' ? v : JSON.stringify(v),
    }));
    const ws3 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws3, '汇总统计');
  }

  if (report.异常类型统计 && report.异常类型统计.length > 0) {
    const ws4 = XLSX.utils.json_to_sheet(report.异常类型统计);
    XLSX.utils.book_append_sheet(wb, ws4, '异常类型统计');
  }

  if (report.设备明细 && report.设备明细.length > 0) {
    const ws5 = XLSX.utils.json_to_sheet(report.设备明细);
    XLSX.utils.book_append_sheet(wb, ws5, '设备明细');
  }

  if (report.异常明细 && report.异常明细.length > 0) {
    const ws6 = XLSX.utils.json_to_sheet(report.异常明细);
    XLSX.utils.book_append_sheet(wb, ws6, '异常明细');
  }

  if (report.补录前后差异对比 && report.补录前后差异对比.length > 0) {
    const ws7 = XLSX.utils.json_to_sheet(report.补录前后差异对比);
    XLSX.utils.book_append_sheet(wb, ws7, '差异对比');
  }

  if (report.操作历史记录 && report.操作历史记录.length > 0) {
    const ws8 = XLSX.utils.json_to_sheet(report.操作历史记录);
    XLSX.utils.book_append_sheet(wb, ws8, '操作历史');
  }

  if (report.备注列表 && report.备注列表.length > 0) {
    const ws9 = XLSX.utils.json_to_sheet(report.备注列表);
    XLSX.utils.book_append_sheet(wb, ws9, '备注');
  }

  if (report.合并记录 && report.合并记录.length > 0) {
    const ws10 = XLSX.utils.json_to_sheet(report.合并记录);
    XLSX.utils.book_append_sheet(wb, ws10, '合并记录');
  }

  XLSX.writeFile(wb, fileName);
}

export function downloadStructuredReport(report: StructuredReport, baseName: string): { jsonFile: string; excelFile: string } {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonFile = `${baseName}-${timestamp}.json`;
  const excelFile = `${baseName}-${timestamp}.xlsx`;
  exportToJSON(report, jsonFile);
  setTimeout(() => exportToExcel(report, excelFile), 300);
  return { jsonFile, excelFile };
}
