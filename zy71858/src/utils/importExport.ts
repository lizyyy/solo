import * as XLSX from 'xlsx';
import { SunshineRecord, RecordStatus } from '@/types';

export interface ImportRecord {
  buildingName: string;
  buildingId?: string;
  floor: number;
  roomNumber: string;
  source: string;
}

export function parseExcelFile(file: File): Promise<ImportRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        const records: ImportRecord[] = jsonData.map((row, index) => ({
          buildingName: row['建筑名称'] || row['buildingName'] || `未命名建筑${index + 1}`,
          buildingId: row['建筑ID'] || row['buildingId'],
          floor: Number(row['楼层'] || row['floor']) || 1,
          roomNumber: String(row['房间号'] || row['roomNumber'] || ''),
          source: row['来源'] || row['source'] || '导入数据',
        }));

        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

interface ExportRecord {
  建筑名称: string;
  楼层: number;
  房间号: string;
  来源: string;
  导入时间: string;
  导入人: string;
  当前状态: string;
  当前处理人: string;
  待处理原因: string;
  是否人工修改: string;
  最后修改时间: string;
  最后修改人: string;
  备注: string;
}

function mapRecordForExport(record: SunshineRecord): ExportRecord {
  const statusMap: Record<RecordStatus, string> = {
    pending: '待处理',
    confirmed: '已确认',
    to_supplement: '待补充',
    modified: '已修改',
  };

  return {
    建筑名称: record.buildingName,
    楼层: record.floor,
    房间号: record.roomNumber,
    来源: record.source,
    导入时间: new Date(record.importTime).toLocaleString('zh-CN'),
    导入人: record.importer,
    当前状态: statusMap[record.status],
    当前处理人: record.currentHandler,
    待处理原因: record.pendingReason || '',
    是否人工修改: record.isManualModified ? '是' : '否',
    最后修改时间: new Date(record.lastModified).toLocaleString('zh-CN'),
    最后修改人: record.lastModifier,
    备注: record.remark || '',
  };
}

export function exportToExcel(records: SunshineRecord[], filename: string = '日照推演记录.xlsx') {
  const confirmed = records.filter((r) => r.status === 'confirmed');
  const toSupplement = records.filter((r) => r.status === 'to_supplement');
  const modified = records.filter((r) => r.status === 'modified' || r.isManualModified);

  const wb = XLSX.utils.book_new();

  const confirmedData = confirmed.map(mapRecordForExport);
  const confirmedWs = XLSX.utils.json_to_sheet([
    { 处理口径: '已确认 - 数据复核无误，可用于教学评估' },
    {},
    ...confirmedData,
  ] as any);
  XLSX.utils.book_append_sheet(wb, confirmedWs, '已确认');

  const supplementData = toSupplement.map(mapRecordForExport);
  const supplementWs = XLSX.utils.json_to_sheet([
    { 处理口径: '待补充 - 需要补充实测数据或修正参数后重新复核' },
    {},
    ...supplementData,
  ] as any);
  XLSX.utils.book_append_sheet(wb, supplementWs, '待补充');

  const modifiedData = modified.map(mapRecordForExport);
  const modifiedWs = XLSX.utils.json_to_sheet([
    { 处理口径: '人工改过 - 已进行人工修正，需跟踪验证修正效果' },
    {},
    ...modifiedData,
  ] as any);
  XLSX.utils.book_append_sheet(wb, modifiedWs, '人工改过');

  XLSX.writeFile(wb, filename);
}

export function downloadTemplate() {
  const templateData = [
    {
      建筑名称: '1号楼',
      楼层: 5,
      房间号: '501',
      来源: '2024春季班-第1组',
    },
    {
      建筑名称: '2号楼',
      楼层: 12,
      房间号: '1203',
      来源: '2024春季班-第2组',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '模板');
  XLSX.writeFile(wb, '日照推演导入模板.xlsx');
}
