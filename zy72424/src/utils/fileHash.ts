import CryptoJS from 'crypto-js';
import { ContractScreenshot } from '../types';

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

export function handleDuplicateImport(
  existing: ContractScreenshot
): { updated: ContractScreenshot; message: string } {
  const updated: ContractScreenshot = {
    ...existing,
    lastImportTime: new Date(),
    importCount: existing.importCount + 1,
  };

  const message = `该文件已于 ${existing.lastImportTime.toLocaleString()} 导入，本次为第 ${existing.importCount + 1} 次导入，统计数量不重复计算`;

  return { updated, message };
}
