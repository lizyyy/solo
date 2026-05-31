import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { BaseRecord, Attachment, ParsedFile, ImportResult, RecordSource, RecordStatus } from '@/types';
import { generateId } from './helpers';

const LATE_THRESHOLD_HOURS = 12;

export async function parseFilePackage(files: File[]): Promise<ImportResult> {
  const parsedFiles: ParsedFile[] = [];
  const warnings: string[] = [];
  const uploadTime = new Date();

  for (const file of files) {
    if (file.name.endsWith('.zip')) {
      const zipFiles = await parseZipFile(file);
      parsedFiles.push(...zipFiles);
    } else {
      const parsed = await parseSingleFile(file, uploadTime);
      if (parsed) {
        parsedFiles.push(parsed);
      } else {
        warnings.push(`不支持的文件格式: ${file.name}`);
      }
    }
  }

  return processParsedFiles(parsedFiles, warnings, uploadTime);
}

async function parseZipFile(zipFile: File): Promise<ParsedFile[]> {
  const zip = new JSZip();
  const content = await zip.loadAsync(zipFile);
  const parsedFiles: ParsedFile[] = [];
  const uploadTime = new Date();

  const promises: Promise<void>[] = [];
  content.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      promises.push(
        zipEntry.async('blob').then(async (blob) => {
          const file = new File([blob], relativePath);
          const parsed = await parseSingleFile(file, uploadTime);
          if (parsed) {
            parsedFiles.push(parsed);
          }
        })
      );
    }
  });

  await Promise.all(promises);
  return parsedFiles;
}

async function parseSingleFile(file: File, uploadTime: Date): Promise<ParsedFile | null> {
  const name = file.name.toLowerCase();
  let content: any = null;
  let type = 'unknown';
  let isLate = false;

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    content = await parseExcelFile(file);
    type = name.includes('巡检') || name.includes('inspection') ? 'inspection' : 'model_list';
  } else if (name.endsWith('.csv')) {
    content = await parseCsvFile(file);
    type = name.includes('巡检') || name.includes('inspection') ? 'inspection' : 'model_list';
  } else if (name.match(/\.(jpg|jpeg|png|gif)$/)) {
    content = file;
    type = 'photo';
  } else if (name.endsWith('.json')) {
    content = JSON.parse(await file.text());
    type = 'manual';
  } else {
    return null;
  }

  if (file.lastModified) {
    const fileTime = new Date(file.lastModified);
    const hoursDiff = (uploadTime.getTime() - fileTime.getTime()) / (1000 * 60 * 60);
    isLate = hoursDiff > LATE_THRESHOLD_HOURS;
  }

  return { name: file.name, type, content, isLate };
}

async function parseExcelFile(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet);
}

async function parseCsvFile(file: File): Promise<any[]> {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => resolve(result.data as any[]),
      error: reject,
    });
  });
}

function processParsedFiles(
  parsedFiles: ParsedFile[],
  warnings: string[],
  uploadTime: Date
): ImportResult {
  const records: BaseRecord[] = [];
  const seenIdentifiers = new Set<string>();

  const dataFiles = parsedFiles.filter(f => f.type !== 'photo');
  const photoFiles = parsedFiles.filter(f => f.type === 'photo');

  for (const file of dataFiles) {
    const rows = Array.isArray(file.content) ? file.content : [file.content];
    
    for (const row of rows) {
      const source: RecordSource = file.type === 'inspection' ? 'inspection_photo' : 
                                   file.type === 'manual' ? 'manual_correction' : 'model_list';
      
      const identifier = `${row['车型'] || row['carModel'] || ''}-${(row['VIN'] || row['vin'] || '').slice(-6)}`;
      const isDuplicate = seenIdentifiers.has(identifier);
      if (identifier) seenIdentifiers.add(identifier);

      let status: RecordStatus = 'normal';
      let pendingReason: string | undefined;

      if (isDuplicate) {
        status = 'duplicate';
      } else if (file.isLate) {
        status = 'late';
      } else if (!row['VIN'] && !row['vin']) {
        status = 'pending';
        pendingReason = '缺少VIN码，需人工确认';
      } else if (!row['位置'] && !row['position']) {
        status = 'pending';
        pendingReason = '缺少展位位置信息';
      }

      const recordId = generateId();
      const matchedPhotos = photoFiles.filter(p => {
        const pName = p.name.toLowerCase();
        return pName.includes((row['车型'] || row['carModel'] || '').toLowerCase()) ||
               pName.includes((row['VIN'] || row['vin'] || '').slice(-6).toLowerCase());
      });

      const attachments: Attachment[] = matchedPhotos.map(p => ({
        id: generateId(),
        recordId,
        fileName: p.name,
        fileType: 'photo',
        fileUrl: URL.createObjectURL(p.content as File),
        isLate: p.isLate,
      }));

      records.push({
        id: recordId,
        source,
        status,
        pendingReason,
        modifiedBy: '系统导入',
        createdAt: uploadTime.toISOString(),
        updatedAt: uploadTime.toISOString(),
        attachments,
        content: {
          modelNumber: row['型号'] || row['modelNumber'] || row['model'] || '',
          vin: row['VIN'] || row['vin'] || '',
          carModel: row['车型'] || row['carModel'] || row['model'] || '',
          color: row['颜色'] || row['color'] || '',
          position: row['位置'] || row['position'] || '',
          arrivalDate: row['到店日期'] || row['arrivalDate'] || '',
          inspectionDate: row['巡检日期'] || row['inspectionDate'] || '',
          notes: row['备注'] || row['notes'] || '',
        },
      });
    }
  }

  for (const photo of photoFiles) {
    const matched = records.some(r => 
      r.attachments.some(a => a.fileName === photo.name)
    );
    if (!matched) {
      const recordId = generateId();
      records.push({
        id: recordId,
        source: 'inspection_photo',
        status: 'pending',
        pendingReason: '照片无法匹配到车型，需人工关联',
        modifiedBy: '系统导入',
        createdAt: uploadTime.toISOString(),
        updatedAt: uploadTime.toISOString(),
        attachments: [{
          id: generateId(),
          recordId,
          fileName: photo.name,
          fileType: 'photo',
          fileUrl: URL.createObjectURL(photo.content as File),
          isLate: photo.isLate,
        }],
        content: {},
      });
    }
  }

  const normalRecords = records.filter(r => r.status === 'normal').length;
  const lateRecords = records.filter(r => r.status === 'late').length;
  const duplicateRecords = records.filter(r => r.status === 'duplicate').length;
  const pendingRecords = records.filter(r => r.status === 'pending').length;

  if (duplicateRecords > 0) {
    warnings.push(`检测到 ${duplicateRecords} 条重复记录，请人工确认`);
  }
  if (pendingRecords > 0) {
    warnings.push(`${pendingRecords} 条记录待处理，请查看原因`);
  }

  return {
    totalRecords: records.length,
    normalRecords,
    lateRecords,
    duplicateRecords,
    pendingRecords,
    records,
    warnings,
  };
}
