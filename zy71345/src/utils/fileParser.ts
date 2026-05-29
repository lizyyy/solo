import * as XLSX from 'xlsx';
import { Part, Musician, Revision, Distribution, ImportDataType } from '../types';

export async function parseFile(file: File, dataType: ImportDataType): Promise<any[]> {
  const text = await readFileAsText(file);
  
  if (file.name.endsWith('.json')) {
    return JSON.parse(text);
  } else if (file.name.endsWith('.csv')) {
    return parseCSV(text, dataType);
  } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    return parseExcel(file, dataType);
  }
  
  throw new Error('不支持的文件格式，请使用 JSON、CSV 或 Excel 文件');
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function parseCSV(text: string, dataType: ImportDataType): any[] {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).filter((l) => l.trim());
  
  return rows.map((row) => {
    const values = row.split(',');
    const obj: Record<string, any> = {};
    headers.forEach((header, i) => {
      obj[header] = values[i]?.trim() || '';
    });
    return transformData(obj, dataType);
  });
}

function parseExcel(file: File, dataType: ImportDataType): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json.map((obj) => transformData(obj as Record<string, any>, dataType)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function transformData(obj: Record<string, any>, dataType: ImportDataType): any {
  const id = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  switch (dataType) {
    case 'parts':
      return {
        id: obj.id || id,
        name: obj.声部名称 || obj.name || '',
        category: obj.声部分类 || obj.category || '',
        totalPages: parseInt(obj.应发页数 || obj.totalPages || '0'),
        pages: parseNumberArray(obj.页码列表 || obj.pages || ''),
      } as Part;
      
    case 'musicians':
      return {
        id: obj.id || id,
        name: obj.姓名 || obj.name || '',
        partId: obj.声部ID || obj.partId || '',
        role: obj.角色 || obj.role || '乐手',
        email: obj.邮箱 || obj.email || '',
      } as Musician;
      
    case 'revisions':
      return {
        id: obj.id || id,
        name: obj.修订页名称 || obj.name || '',
        pageNumber: obj.页码 || obj.pageNumber || '',
        partIds: parseStringArray(obj.适用声部ID || obj.partIds || ''),
        issueDate: obj.发布日期 || obj.issueDate || new Date().toISOString().split('T')[0],
        description: obj.说明 || obj.description || '',
      } as Revision;
      
    case 'distributions':
      return {
        id: obj.id || id,
        musicianId: obj.乐手ID || obj.musicianId || '',
        partId: obj.声部ID || obj.partId || '',
        pagesReceived: parseStringArray(obj.收到页码 || obj.pagesReceived || ''),
        revisionIds: parseStringArray(obj.收到修订页ID || obj.revisionIds || ''),
        distributedAt: obj.发放时间 || obj.distributedAt || new Date().toLocaleString('zh-CN'),
        distributedBy: obj.发放人 || obj.distributedBy || '管理员',
      } as Distribution;
      
    default:
      return obj;
  }
}

function parseNumberArray(str: string): number[] {
  if (!str) return [];
  if (Array.isArray(str)) return str.map(Number);
  return str
    .split(/[,，、\s]+/)
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));
}

function parseStringArray(str: string): string[] {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  return str.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
}

export function getTemplateHeaders(dataType: ImportDataType): string[] {
  switch (dataType) {
    case 'parts':
      return ['声部名称', '声部分类', '应发页数', '页码列表'];
    case 'musicians':
      return ['姓名', '声部ID', '角色', '邮箱'];
    case 'revisions':
      return ['修订页名称', '页码', '适用声部ID', '发布日期', '说明'];
    case 'distributions':
      return ['乐手ID', '声部ID', '收到页码', '收到修订页ID', '发放时间', '发放人'];
    default:
      return [];
  }
}

export function downloadTemplate(dataType: ImportDataType): void {
  const headers = getTemplateHeaders(dataType);
  const csv = headers.join(',') + '\n';
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getDataTypeName(dataType)}导入模板.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getDataTypeName(dataType: ImportDataType): string {
  const names: Record<ImportDataType, string> = {
    parts: '声部谱',
    pageRules: '页码规则',
    musicians: '乐手名单',
    revisions: '修订页',
    distributions: '发放记录',
  };
  return names[dataType] || dataType;
}
