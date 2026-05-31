import * as XLSX from 'xlsx';
import { ParsedExcelRow, CableRecord, SourceType } from '@/types';

const COLUMN_MAPPINGS: Record<string, keyof ParsedExcelRow> = {
  '线缆编号': 'cableNo',
  'cableNo': 'cableNo',
  '机房': 'room',
  'room': 'room',
  '机柜': 'cabinet',
  'cabinet': 'cabinet',
  '起点X': 'startX',
  'startX': 'startX',
  '起点Y': 'startY',
  'startY': 'startY',
  '终点X': 'endX',
  'endX': 'endX',
  '终点Y': 'endY',
  'endY': 'endY',
  '线缆类型': 'cableType',
  'cableType': 'cableType',
  '备注': 'remark',
  'remark': 'remark',
};

export function parseExcelFile(file: File): Promise<ParsedExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        
        const parsedRows: ParsedExcelRow[] = jsonData.map((row: any) => {
          const parsed: ParsedExcelRow = {};
          Object.keys(row).forEach(key => {
            const mappedKey = COLUMN_MAPPINGS[key.trim()];
            if (mappedKey) {
              if (['startX', 'startY', 'endX', 'endY'].includes(mappedKey)) {
                parsed[mappedKey] = Number(row[key]);
              } else {
                parsed[mappedKey] = row[key];
              }
            }
          });
          return parsed;
        });
        
        resolve(parsedRows);
      } catch (error) {
        reject(new Error('Excel文件解析失败，请检查文件格式'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsBinaryString(file);
  });
}

export function transformToCableRecords(
  rows: ParsedExcelRow[],
  sourceType: SourceType,
  sourceId: string,
  ownerId: string
): Partial<CableRecord>[] {
  return rows.map(row => {
    const record: Partial<CableRecord> = {
      cableNo: row.cableNo,
      room: row.room,
      cabinet: row.cabinet,
      cableType: row.cableType,
      remark: row.remark,
      sourceId,
      ownerId,
      status: 'pending',
      coordinatesFlipped: false,
    };
    
    if (row.startX !== undefined && row.startY !== undefined) {
      record.startPoint = { x: row.startX, y: row.startY };
    }
    
    if (row.endX !== undefined && row.endY !== undefined) {
      record.endPoint = { x: row.endX, y: row.endY };
    }
    
    return record;
  });
}

export function generateTemplateExcel(): void {
  const headers = ['线缆编号', '机房', '机柜', '起点X', '起点Y', '终点X', '终点Y', '线缆类型', '备注'];
  const sampleData = [
    ['CBL-A01-001', 'A机房', 'A01', 10, 20, 30, 40, '光纤', '核心交换机至存储设备'],
    ['CBL-A01-002', 'A机房', 'A01', 15, 25, 35, 45, '网线', '待确认两端设备'],
  ];
  
  const wsData = [headers, ...sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '线缆数据');
  XLSX.writeFile(wb, '线缆数据导入模板.xlsx');
}

export function validateRow(row: ParsedExcelRow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!row.cableNo) errors.push('线缆编号不能为空');
  if (!row.room) errors.push('机房不能为空');
  if (!row.cabinet) errors.push('机柜不能为空');
  if (row.startX === undefined || isNaN(row.startX)) errors.push('起点X必须是有效数字');
  if (row.startY === undefined || isNaN(row.startY)) errors.push('起点Y必须是有效数字');
  if (row.endX === undefined || isNaN(row.endX)) errors.push('终点X必须是有效数字');
  if (row.endY === undefined || isNaN(row.endY)) errors.push('终点Y必须是有效数字');
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
