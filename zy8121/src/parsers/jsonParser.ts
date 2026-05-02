import * as fs from 'fs';
import { BarcodeItem } from '../types';

export function parseBarcodesJson(filePath: string): BarcodeItem[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);
  
  if (Array.isArray(parsed)) {
    return parsed.map(normalizeBarcodeItem);
  }
  
  if (parsed.barcodes && Array.isArray(parsed.barcodes)) {
    return parsed.barcodes.map(normalizeBarcodeItem);
  }
  
  return [normalizeBarcodeItem(parsed)];
}

function normalizeBarcodeItem(item: Record<string, unknown>): BarcodeItem {
  return {
    id: String(item.id || item.barcodeId || item['条码ID'] || ''),
    type: (item.type || item['类型'] || 'CODE128') as BarcodeItem['type'],
    value: String(item.value || item['值'] || item.code || ''),
    x: Number(item.x || item['x坐标'] || 0),
    y: Number(item.y || item['y坐标'] || 0),
    width: Number(item.width || item['宽度'] || 30),
    height: Number(item.height || item['高度'] || 20),
    rotation: item.rotation !== undefined ? Number(item.rotation) : undefined,
  };
}

export function parseJsonFile<T = unknown>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}
