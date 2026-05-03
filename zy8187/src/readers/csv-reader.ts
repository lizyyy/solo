import * as fs from 'fs';
import csv from 'csv-parser';
import { PrinterProfile } from '../types';

export async function readCsvFile(filePath: string): Promise<PrinterProfile[]> {
  return new Promise((resolve, reject) => {
    const profiles: PrinterProfile[] = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: any) => {
        const profile = validateAndTransformProfile(row);
        if (profile) {
          profiles.push(profile);
        }
      })
      .on('end', () => {
        resolve(profiles);
      })
      .on('error', (error: Error) => {
        reject(new Error(`读取 CSV 文件失败: ${error.message}`));
      });
  });
}

function validateAndTransformProfile(row: any): PrinterProfile | null {
  if (!row.model) {
    console.warn('跳过无效的打印机配置: 缺少 model 字段');
    return null;
  }

  const profile: PrinterProfile = {
    model: row.model,
    width: validateWidth(row.width),
    charsPerLine: parseInt(row.charsPerLine, 10) || (row.width === '80mm' ? 48 : 32),
    supportsQRCode: parseBoolean(row.supportsQRCode, true),
    supportsBarcode: parseBoolean(row.supportsBarcode, true),
    supportsCut: parseBoolean(row.supportsCut, true),
    supportsOpenDrawer: parseBoolean(row.supportsOpenDrawer, true),
    maxBarcodeHeight: parseInt(row.maxBarcodeHeight, 10) || 80,
    qrCodeSize: parseInt(row.qrCodeSize, 10) || 4
  };

  return profile;
}

function validateWidth(width: any): '58mm' | '80mm' {
  if (width === '58mm' || width === '80mm') {
    return width;
  }
  console.warn(`无效的打印机宽度: ${width}，默认使用 58mm`);
  return '58mm';
}

function parseBoolean(value: any, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  
  const strValue = String(value).toLowerCase().trim();
  
  if (strValue === 'true' || strValue === 'yes' || strValue === '1' || strValue === 'y') {
    return true;
  }
  
  if (strValue === 'false' || strValue === 'no' || strValue === '0' || strValue === 'n') {
    return false;
  }
  
  return defaultValue;
}