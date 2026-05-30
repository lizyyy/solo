import * as XLSX from 'xlsx';
import type { Material, MaterialType, MaterialImportResult } from '../types';
import { calculateDataHash, generateId } from '../utils/hash';
import { detectMaterialUpdate } from './deduplicate';
import { createEvidenceRef, formatLocation } from './evidence';

export function parseExcelFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1);
        
        const result = rows.map((row: any[], rowIndex) => {
          const obj: Record<string, any> = {
            _rowNumber: rowIndex + 2,
            _sheetName: workbook.SheetNames[0],
          };
          headers.forEach((header, colIndex) => {
            if (header) {
              const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
              obj[header.trim()] = row[colIndex];
              obj[`_location_${header.trim()}`] = formatLocation(
                workbook.SheetNames[0],
                rowIndex + 2,
                cellAddress.replace(/\d+/g, '')
              );
            }
          });
          return obj;
        });
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export function parseCsvFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        const result: Record<string, any>[] = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj: Record<string, any> = {
            _rowNumber: i + 1,
            _sheetName: 'CSV',
          };
          headers.forEach((header, colIndex) => {
            if (header) {
              obj[header] = values[colIndex] || '';
              obj[`_location_${header}`] = formatLocation('CSV', i + 1, colIndex);
            }
          });
          result.push(obj);
        }
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function detectMaterialType(filename: string): MaterialType | null {
  const lower = filename.toLowerCase();
  
  if (lower.includes('条款') || lower.includes('term') || lower.includes('产品说明')) {
    return 'product_terms';
  }
  if (lower.includes('持仓') || lower.includes('position') || lower.includes('客户')) {
    return 'customer_position';
  }
  if (lower.includes('价格') || lower.includes('price') || lower.includes('行情') || lower.includes('标的')) {
    return 'underlying_price';
  }
  
  return null;
}

export async function importMaterial(
  file: File,
  batchId: string,
  existingMaterials: Material[],
  source: string = 'manual',
  forcedType?: MaterialType
): Promise<MaterialImportResult> {
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  let parsedData: Record<string, any>[];
  
  if (fileExt === 'xlsx' || fileExt === 'xls') {
    parsedData = await parseExcelFile(file);
  } else if (fileExt === 'csv') {
    parsedData = await parseCsvFile(file);
  } else {
    throw new Error('不支持的文件格式，仅支持 .xlsx, .xls, .csv');
  }
  
  const type = forcedType || detectMaterialType(file.name);
  if (!type) {
    throw new Error('无法自动识别材料类型，请手动选择');
  }
  
  const content = parsedData.length === 1 ? parsedData[0] : { rows: parsedData };
  const dataHash = calculateDataHash(content);
  
  const material: Material = {
    id: generateId('mat'),
    batchId,
    type,
    filename: file.name,
    content,
    rawContent: JSON.stringify(content, null, 2),
    dataHash,
    importedAt: new Date(),
    source,
    version: 1,
    status: 'new',
  };
  
  const detectionResult = detectMaterialUpdate(material, existingMaterials);
  material.status = detectionResult.status;
  
  if (detectionResult.existingMaterialId) {
    material.duplicateOf = detectionResult.existingMaterialId;
    const existing = existingMaterials.find(m => m.id === detectionResult.existingMaterialId);
    if (existing) {
      material.version = existing.version + 1;
      material.previousVersion = existing.id;
    }
  }
  
  return { material, detectionResult };
}

export function getFieldLocation(content: Record<string, any>, fieldName: string): string | null {
  return content[`_location_${fieldName}`] || null;
}

export function getFieldEvidence(
  material: Material,
  fieldName: string,
  value?: string
) {
  const location = getFieldLocation(material.content, fieldName);
  if (!location) return null;
  
  return createEvidenceRef(
    material,
    location,
    value ?? String(material.content[fieldName] ?? '')
  );
}
