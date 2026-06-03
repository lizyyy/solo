import CryptoJS from 'crypto-js';

export class HashService {
  calculateFileHash(content: string): string {
    return CryptoJS.SHA256(content).toString();
  }

  calculateContentFingerprint(rows: any[]): string {
    const normalized = rows.map(row =>
      Object.values(row)
        .map(v => String(v).trim())
        .join('|')
    ).join('||');
    return CryptoJS.MD5(normalized).toString();
  }
}

export const hashService = new HashService();
