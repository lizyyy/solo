import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { CarbonRecord, SourceType } from '@/types';

export interface ParsedData {
  records: Partial<CarbonRecord>[];
  sourceType: SourceType;
  fileName: string;
  errors: string[];
}

export function detectSourceType(fileName: string): SourceType {
  const lower = fileName.toLowerCase();
  if (lower.includes('审批') || lower.includes('approval')) {
    return 'approval_record';
  }
  if (lower.includes('照片') || lower.includes('巡检') || lower.includes('photo') || lower.includes('inspection')) {
    return 'inspection_photo';
  }
  return 'street_form';
}

export function parseExcel(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        const sourceType = detectSourceType(file.name);
        const records = jsonData.map((row: any) => mapRowToRecord(row, sourceType));
        
        resolve({
          records,
          sourceType,
          fileName: file.name,
          errors: [],
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export function parseCSV(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        });
        
        const sourceType = detectSourceType(file.name);
        const records = result.data.map((row: any) => mapRowToRecord(row, sourceType));
        
        resolve({
          records,
          sourceType,
          fileName: file.name,
          errors: result.errors.map(e => e.message),
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

function mapRowToRecord(row: any, sourceType: SourceType): Partial<CarbonRecord> {
  const getValue = (keys: string[]): string => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return String(row[key]).trim();
      }
    }
    return '';
  };

  const getNumber = (keys: string[]): number => {
    const value = getValue(keys);
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  return {
    pointName: getValue(['点位名称', '名称', 'pointName', 'name', '点位']),
    originalName: getValue(['原始名称', 'originalName', '名称']),
    sourceType,
    address: getValue(['地址', 'address', '位置', 'location']),
    carbonAmount: getNumber(['碳排放量', '排放量', 'carbonAmount', 'amount', '碳减排量']),
    unit: getValue(['单位', 'unit']) || 'kgCO2e',
    recordDate: getValue(['记录日期', '日期', 'recordDate', 'date']) || new Date().toISOString().split('T')[0],
    dataQuality: 'normal' as const,
    remark: getValue(['备注', 'remark', '说明']),
    location: {
      lat: getNumber(['纬度', 'lat', 'latitude']),
      lng: getNumber(['经度', 'lng', 'longitude']),
    },
  };
}

export function generateSampleExcel(): void {
  const sampleData = [
    {
      '点位名称': '东城区和平里街道7号院碳排放点',
      '地址': '东城区和平里街道7号院',
      '碳排放量': '120.5',
      '单位': 'kgCO2e',
      '记录日期': '2024-01-15',
      '备注': '月度巡检数据',
    },
    {
      '点位名称': '地坛公园南门绿化碳汇点',
      '地址': '东城区地坛公园南门',
      '碳排放量': '45.2',
      '单位': 'kgCO2e',
      '记录日期': '2024-01-16',
      '备注': '绿化碳汇监测',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '低碳街区数据');
  XLSX.writeFile(workbook, '低碳街区碳账本样例数据.xlsx');
}
