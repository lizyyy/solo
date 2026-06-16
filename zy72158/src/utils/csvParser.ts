import { ImportData, SourceType } from '@/types';

export interface GenericRow {
  [key: string]: string;
}

export type CSVRow = GenericRow;

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['商户名称', '商户', '名称', '店名', 'name', '商户名', '品牌'],
  location: ['位置', '地址', '位置描述', '所在位置', 'location', '详细地址', '经营地址'],
  area: ['面积', '外摆面积', '外摆面积(㎡)', '面积(㎡)', 'area', '占地面积', '外摆面积平方米'],
  timePeriod: ['时间段', '经营时间', '营业时间', '经营时间段', 'time', '营业时间(起-止)'],
  contact: ['联系人', '负责人', '联系人姓名', 'contact', '责任人'],
  phone: ['电话', '联系电话', '手机', 'phone', '联系方式', '手机号'],
  lat: ['纬度', 'lat', 'latitude', 'WGS84纬度', 'y坐标'],
  lng: ['经度', 'lng', 'longitude', 'WGS84经度', 'x坐标'],
};

function findFieldKey(header: string): string | null {
  const normalized = header.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some(a => a.toLowerCase() === normalized)) {
      return key;
    }
  }
  return null;
}

export function mapGenericRowToImportData(
  row: GenericRow,
  sourceType: SourceType,
  sourceName: string
): ImportData | null {
  const mapped: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const key = findFieldKey(header);
    if (key) {
      mapped[key] = value;
    }
  }

  if (!mapped.name) return null;

  const area = parseFloat(mapped.area);
  if (isNaN(area) || area <= 0) return null;

  return {
    name: mapped.name,
    location: mapped.location || '',
    area,
    timePeriod: mapped.timePeriod || '10:00-22:00',
    lat: mapped.lat ? parseFloat(mapped.lat) : undefined,
    lng: mapped.lng ? parseFloat(mapped.lng) : undefined,
    contact: mapped.contact || undefined,
    phone: mapped.phone || undefined,
    sourceType,
    sourceName,
    rawData: JSON.stringify(row),
  };
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): CSVRow[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const row: CSVRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] !== undefined ? values[idx].replace(/^"|"$/g, '').trim() : '';
    });
    rows.push(row);
  }

  return rows;
}

export function parseCSVToImportData(
  text: string,
  sourceType: SourceType,
  sourceName: string
): ImportData[] {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];

  return rows
    .map(row => mapGenericRowToImportData(row, sourceType, sourceName))
    .filter((item): item is ImportData => item !== null);
}
