import CryptoJS from 'crypto-js';
import { ContractScreenshot } from '../types';
import { formatDate } from './boundaryRules';

export async function calculateFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        const hash = CryptoJS.SHA256(wordArray).toString();
        resolve(`sha256_${hash}`);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function checkDuplicate(
  hash: string,
  contracts: ContractScreenshot[]
): ContractScreenshot | null {
  return contracts.find((c) => c.fileHash === hash) || null;
}

export function isDuplicateImport(
  hash: string,
  contracts: ContractScreenshot[]
): boolean {
  return contracts.some((c) => c.fileHash === hash);
}

export interface DuplicateImportResult {
  updated: ContractScreenshot;
  message: string;
  details: {
    fileName: string;
    prevImportCount: number;
    newImportCount: number;
    lastImportTime: Date;
    newImportTime: Date;
    isDuplicate: true;
  };
}

export function handleDuplicateImport(
  existing: ContractScreenshot
): DuplicateImportResult {
  const prevCount = Number(existing.importCount) || 1;
  const newCount = prevCount + 1;
  const newImportTime = new Date();
  const lastImportTime = existing.lastImportTime instanceof Date
    ? existing.lastImportTime
    : new Date(existing.lastImportTime);

  const updated: ContractScreenshot = {
    ...existing,
    lastImportTime: newImportTime,
    importCount: newCount,
  };

  const message = `文件「${existing.fileName}」已于 ${formatDate(lastImportTime)} 导入（第 ${prevCount} 次），本次为第 ${newCount} 次重复导入。仅更新导入时间，排练迟到统计数量不翻倍。`;

  return {
    updated,
    message,
    details: {
      fileName: existing.fileName,
      prevImportCount: prevCount,
      newImportCount: newCount,
      lastImportTime,
      newImportTime,
      isDuplicate: true,
    },
  };
}
