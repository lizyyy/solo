import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SourceData, SourceType, GarbagePoint, PointStatus, ExportConfig, sourceTypeLabels, pointStatusLabels, exportColumnOptions } from '@/types';
import { generateShortId, formatDateTime } from './stringUtils';
import { isValidCoordinate } from './geoUtils';

export interface ImportResult {
  success: boolean;
  data: SourceData[];
  errors: string[];
  warnings: string[];
}

export interface RawPreview {
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

export async function extractRawCSV(file: File): Promise<RawPreview> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, any>[];
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        resolve({ headers, rows, totalRows: rows.length });
      },
      error: (error) => {
        reject(new Error(`CSV解析失败: ${error.message}`));
      },
    });
  });
}

export async function extractRawExcel(file: File): Promise<RawPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows, totalRows: rows.length };
}

export function applyMappingAndParse(
  rawRows: Record<string, any>[],
  mapping: Record<string, string>,
  sourceType: SourceType
): ImportResult {
  const result: ImportResult = { success: true, data: [], errors: [], warnings: [] };

  rawRows.forEach((rawRow, index) => {
    try {
      const remappedRow: Record<string, any> = {};
      Object.entries(rawRow).forEach(([key, value]) => {
        if (mapping[key]) {
          remappedRow[mapping[key]] = value;
        } else {
          remappedRow[key] = value;
        }
      });

      const sourceData = parseRowToSourceData(remappedRow, sourceType, index + 2);
      if (sourceData) {
        result.data.push(sourceData);
      }
    } catch (error: any) {
      result.errors.push(`第 ${index + 2} 行: ${error.message}`);
    }
  });

  if (result.data.length === 0 && result.errors.length > 0) {
    result.success = false;
    result.warnings.push(
      '所有行解析失败，请检查字段映射是否正确。'
      + '提示：名称字段为必填项，请确保至少一列映射到"点位名称"。'
    );
  }

  return result;
}

export async function parseCSVFile(file: File, sourceType: SourceType, mapping?: Record<string, string>): Promise<ImportResult> {
  try {
    const preview = await extractRawCSV(file);
    if (mapping && Object.keys(mapping).length > 0) {
      return applyMappingAndParse(preview.rows, mapping, sourceType);
    }
    return applyMappingAndParse(preview.rows, {}, sourceType);
  } catch (error: any) {
    return { success: false, data: [], errors: [`解析错误: ${error.message}`], warnings: [] };
  }
}

export async function parseExcelFile(file: File, sourceType: SourceType, mapping?: Record<string, string>): Promise<ImportResult> {
  try {
    const preview = await extractRawExcel(file);
    if (mapping && Object.keys(mapping).length > 0) {
      return applyMappingAndParse(preview.rows, mapping, sourceType);
    }
    return applyMappingAndParse(preview.rows, {}, sourceType);
  } catch (error: any) {
    return { success: false, data: [], errors: [`解析错误: ${error.message}`], warnings: [] };
  }
}

export async function parseGeoJSONFile(file: File, sourceType: SourceType): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    data: [],
    errors: [],
    warnings: [],
  };

  try {
    const text = await file.text();
    const geojson = JSON.parse(text);

    if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      result.errors.push('无效的GeoJSON格式，需要FeatureCollection');
      result.success = false;
      return result;
    }

    geojson.features.forEach((feature: any, index: number) => {
      try {
        if (feature.type !== 'Feature' || !feature.geometry) {
          result.warnings.push(`第 ${index + 1} 个要素: 无效的Feature格式，已跳过`);
          return;
        }

        const coordinates = feature.geometry.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
          result.warnings.push(`第 ${index + 1} 个要素: 无效的坐标，已跳过`);
          return;
        }

        const [lng, lat] = coordinates;
        if (!isValidCoordinate(lat, lng)) {
          result.warnings.push(`第 ${index + 1} 个要素: 坐标超出有效范围，已跳过`);
          return;
        }

        const properties = feature.properties || {};
        const name = properties.name || properties.名称 || properties.title || `点位${index + 1}`;

        const sourceData: SourceData = {
          id: generateShortId(),
          pointId: '',
          sourceType,
          sourceName: name,
          rawData: {
            ...properties,
            lng,
            lat,
            coordinates,
          },
          operator: '系统导入',
          importedAt: new Date(),
          confidence: 1.0,
        };

        result.data.push(sourceData);
      } catch (error: any) {
        result.errors.push(`第 ${index + 1} 个要素: ${error.message}`);
      }
    });
  } catch (error: any) {
    result.errors.push(`解析错误: ${error.message}`);
    result.success = false;
  }

  return result;
}

export async function parseImageFile(file: File): Promise<{ dataUrl: string; exif?: { lat: number; lng: number } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      resolve({ dataUrl });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseRowToSourceData(row: Record<string, any>, sourceType: SourceType, lineNum: number): SourceData | null {
  const nameField = findField(row, ['name', '名称', '点位名称', '投放点名称', 'title']);
  const latField = findField(row, ['lat', 'latitude', '纬度', 'y']);
  const lngField = findField(row, ['lng', 'lon', 'longitude', '经度', 'x']);
  const addressField = findField(row, ['address', '地址', '位置', '详细地址']);
  const streetField = findField(row, ['street', '街道', '所属街道', '街道办事处']);

  if (!nameField) {
    const availableKeys = Object.keys(row).filter(k => row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '');
    throw new Error(
      '未找到名称字段。'
      + (availableKeys.length > 0
        ? `请将以下字段之一映射到"点位名称"：${availableKeys.join('、')}`
        : '该行所有字段为空')
    );
  }

  const name = row[nameField] as string;
  if (!name || String(name).trim() === '') {
    throw new Error(`字段"${nameField}"的值为空`);
  }

  let lat: number | undefined;
  let lng: number | undefined;

  if (latField && lngField) {
    lat = parseFloat(row[latField]);
    lng = parseFloat(row[lngField]);
    
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('坐标格式无效');
    }
    
    if (!isValidCoordinate(lat, lng)) {
      throw new Error('坐标超出有效范围');
    }
  }

  const rawData: Record<string, any> = { ...row };
  if (lat !== undefined && lng !== undefined) {
    rawData.lat = lat;
    rawData.lng = lng;
  }
  if (addressField) {
    rawData.address = row[addressField];
  }
  if (streetField) {
    rawData.street = row[streetField];
  }

  return {
    id: generateShortId(),
    pointId: '',
    sourceType,
    sourceName: String(name).trim(),
    rawData,
    operator: '系统导入',
    importedAt: new Date(),
    confidence: 1.0,
  };
}

function findField(row: Record<string, any>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find(k => k.toLowerCase() === candidate.toLowerCase());
    if (found) return found;
  }
  return undefined;
}

export async function exportToExcel(points: GarbagePoint[], config: ExportConfig): Promise<Blob> {
  const rows = points.map(point => {
    const row: Record<string, any> = {};
    
    config.columns.forEach(col => {
      switch (col) {
        case 'canonicalName':
          row['标准名称'] = point.canonicalName;
          break;
        case 'address':
          row['地址'] = point.address;
          break;
        case 'street':
          row['所属街道'] = point.street;
          break;
        case 'lat':
          row['纬度'] = point.lat;
          break;
        case 'lng':
          row['经度'] = point.lng;
          break;
        case 'status':
          row['状态'] = pointStatusLabels[point.status];
          break;
        case 'sourceCount':
          row['来源数量'] = point.sources.length;
          break;
        case 'sourceTypes':
          row['来源类型'] = [...new Set(point.sources.map(s => sourceTypeLabels[s.sourceType]))].join('、');
          break;
        case 'mergeReason':
          row['归并依据'] = point.mergeReason;
          break;
        case 'createdAt':
          row['创建时间'] = formatDateTime(point.createdAt);
          break;
        case 'updatedAt':
          row['更新时间'] = formatDateTime(point.updatedAt);
          break;
      }
    });

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '垃圾分类投放点位');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function exportToPDF(points: GarbagePoint[], config: ExportConfig): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('垃圾分类投放点位公示清单', 140, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`生成时间: ${formatDateTime(new Date())}`, 10, 25);
  doc.text(`点位总数: ${points.length}`, 10, 32);

  if (config.watermark) {
    doc.setFontSize(60);
    doc.setTextColor(200, 200, 200);
    doc.text('内部资料', 140, 150, { align: 'center', angle: 45 });
    doc.setTextColor(0, 0, 0);
  }

  const columns = config.columns.map(col => {
    const option = exportColumnOptions.find(o => o.value === col);
    return option?.label || col;
  });

  const rows = points.map(point => {
    return config.columns.map(col => {
      switch (col) {
        case 'canonicalName': return point.canonicalName;
        case 'address': return point.address;
        case 'street': return point.street;
        case 'lat': return point.lat.toFixed(6);
        case 'lng': return point.lng.toFixed(6);
        case 'status': return pointStatusLabels[point.status];
        case 'sourceCount': return String(point.sources.length);
        case 'sourceTypes': return [...new Set(point.sources.map(s => sourceTypeLabels[s.sourceType]))].join('、');
        case 'mergeReason': return point.mergeReason;
        case 'createdAt': return formatDateTime(point.createdAt);
        case 'updatedAt': return formatDateTime(point.updatedAt);
        default: return '';
      }
    });
  });

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 40,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 90, 168], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 40, bottom: 20 },
  });

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
