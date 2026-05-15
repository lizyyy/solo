import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import type { ExportCertificate } from '../types';

const SIGNATURE_SECRET = process.env.SIGNATURE_SECRET || 'tenant-export-secret-key-2024';

export class ExportCertificateModel {
  static findByTaskId(taskId: string): ExportCertificate | null {
    const row = db.prepare('SELECT * FROM export_certificates WHERE taskId = ?').get(taskId) as any;
    if (!row) return null;
    return {
      ...row,
      metadata: JSON.parse(row.metadata)
    };
  }

  static generateCertificateNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `EXP-${dateStr}-${random}`;
  }

  static signMetadata(metadata: ExportCertificate['metadata']): string {
    const payload = JSON.stringify(metadata);
    return CryptoJS.HmacSHA256(payload, SIGNATURE_SECRET).toString(CryptoJS.enc.Hex);
  }

  static create(data: Omit<ExportCertificate, 'id' | 'certificateNumber' | 'signature'>): ExportCertificate {
    const id = uuidv4();
    const certificateNumber = this.generateCertificateNumber();
    const signature = this.signMetadata(data.metadata);
    db.prepare(`
      INSERT INTO export_certificates (id, taskId, certificateNumber, issuedAt, issuer, metadata, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.taskId,
      certificateNumber,
      data.issuedAt,
      data.issuer,
      JSON.stringify(data.metadata),
      signature
    );
    return this.findByTaskId(data.taskId)!;
  }

  static verify(certificate: ExportCertificate): boolean {
    const expectedSignature = this.signMetadata(certificate.metadata);
    return expectedSignature === certificate.signature;
  }
}
