import db from '../connection';
import { Certificate, CertificateStatus, CertificateType, CheckResult } from '../../types';
import { generateId, normalizeDate } from '../../utils/validators';
import { NotFoundError } from '../../utils/errors';

export interface DBCertificate {
  id: string;
  name: string;
  type: string;
  domain?: string;
  issuer?: string;
  issue_date: string;
  expiry_date: string;
  serial_number?: string;
  fingerprint?: string;
  description?: string;
  owner_id?: string;
  owner_name?: string;
  owner_email?: string;
  department?: string;
  source: string;
  source_file?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

function mapToCertificate(dbCert: DBCertificate): Certificate {
  return {
    id: dbCert.id,
    name: dbCert.name,
    type: dbCert.type as CertificateType,
    domain: dbCert.domain,
    issuer: dbCert.issuer,
    issueDate: dbCert.issue_date,
    expiryDate: dbCert.expiry_date,
    serialNumber: dbCert.serial_number,
    fingerprint: dbCert.fingerprint,
    description: dbCert.description,
    ownerId: dbCert.owner_id,
    ownerName: dbCert.owner_name,
    ownerEmail: dbCert.owner_email,
    department: dbCert.department,
    source: dbCert.source,
    sourceFile: dbCert.source_file,
    status: dbCert.status as CertificateStatus,
    notes: dbCert.notes,
    createdAt: dbCert.created_at,
    updatedAt: dbCert.updated_at
  };
}

export class CertificateRepository {
  async create(certificate: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>): Promise<Certificate> {
    const id = generateId();
    const now = new Date().toISOString();
    
    await db.run(`
      INSERT INTO certificates (
        id, name, type, domain, issuer, issue_date, expiry_date, 
        serial_number, fingerprint, description, owner_id, owner_name, 
        owner_email, department, source, source_file, status, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      certificate.name,
      certificate.type,
      certificate.domain,
      certificate.issuer,
      normalizeDate(certificate.issueDate),
      normalizeDate(certificate.expiryDate),
      certificate.serialNumber,
      certificate.fingerprint,
      certificate.description,
      certificate.ownerId,
      certificate.ownerName,
      certificate.ownerEmail,
      certificate.department,
      certificate.source,
      certificate.sourceFile,
      certificate.status,
      certificate.notes,
      now,
      now
    ]);
    
    return this.findById(id);
  }

  async findById(id: string): Promise<Certificate> {
    const result = await db.get<DBCertificate>('SELECT * FROM certificates WHERE id = ?', [id]);
    if (!result) {
      throw new NotFoundError(`证书不存在: ${id}`);
    }
    return mapToCertificate(result);
  }

  async findAll(): Promise<Certificate[]> {
    const results = await db.all<DBCertificate>('SELECT * FROM certificates ORDER BY expiry_date ASC');
    return results.map(mapToCertificate);
  }

  async findByType(type: CertificateType): Promise<Certificate[]> {
    const results = await db.all<DBCertificate>(
      'SELECT * FROM certificates WHERE type = ? ORDER BY expiry_date ASC',
      [type]
    );
    return results.map(mapToCertificate);
  }

  async findExpiringWithin(days: number): Promise<Certificate[]> {
    const today = new Date();
    const targetDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const targetStr = targetDate.toISOString().split('T')[0];
    
    const results = await db.all<DBCertificate>(`
      SELECT * FROM certificates 
      WHERE expiry_date >= ? AND expiry_date <= ?
      AND status != ?
      ORDER BY expiry_date ASC
    `, [todayStr, targetStr, CertificateStatus.MERGED]);
    
    return results.map(mapToCertificate);
  }

  async findExpired(): Promise<Certificate[]> {
    const today = new Date().toISOString().split('T')[0];
    const results = await db.all<DBCertificate>(`
      SELECT * FROM certificates 
      WHERE expiry_date < ?
      AND status != ?
      ORDER BY expiry_date ASC
    `, [today, CertificateStatus.MERGED]);
    
    return results.map(mapToCertificate);
  }

  async findPotentialDuplicates(): Promise<CheckResult[]> {
    const duplicates: CheckResult[] = [];
    
    const byFingerprint = await db.all<any>(`
      SELECT fingerprint, GROUP_CONCAT(id) as ids, COUNT(*) as cnt
      FROM certificates 
      WHERE fingerprint IS NOT NULL AND fingerprint != ''
      AND status != ?
      GROUP BY fingerprint 
      HAVING COUNT(*) > 1
    `, [CertificateStatus.MERGED]);
    
    byFingerprint.forEach(row => {
      if (row.ids) {
        duplicates.push({
          id: generateId(),
          type: 'DUPLICATE',
          severity: 'medium',
          message: `发现指纹相同的证书: ${row.fingerprint}`,
          certificateIds: row.ids.split(',')
        });
      }
    });
    
    const bySerial = await db.all<any>(`
      SELECT serial_number, type, GROUP_CONCAT(id) as ids, COUNT(*) as cnt
      FROM certificates 
      WHERE serial_number IS NOT NULL AND serial_number != ''
      AND status != ?
      GROUP BY serial_number, type 
      HAVING COUNT(*) > 1
    `, [CertificateStatus.MERGED]);
    
    bySerial.forEach(row => {
      if (row.ids && !duplicates.some(d => d.message.includes(row.serial_number))) {
        duplicates.push({
          id: generateId(),
          type: 'DUPLICATE',
          severity: 'medium',
          message: `发现序列号相同的证书: ${row.serial_number}`,
          certificateIds: row.ids.split(',')
        });
      }
    });
    
    const byNameAndDomain = await db.all<any>(`
      SELECT name, domain, type, GROUP_CONCAT(id) as ids, COUNT(*) as cnt
      FROM certificates 
      WHERE name IS NOT NULL 
      AND status != ?
      GROUP BY name, COALESCE(domain, ''), type 
      HAVING COUNT(*) > 1
    `, [CertificateStatus.MERGED]);
    
    byNameAndDomain.forEach(row => {
      if (row.ids) {
        const ids = row.ids.split(',');
        if (!duplicates.some(d => d.certificateIds.some(cid => ids.includes(cid)))) {
          duplicates.push({
            id: generateId(),
            type: 'DUPLICATE',
            severity: 'low',
            message: `发现可能重复的证书: ${row.name}${row.domain ? ' (' + row.domain + ')' : ''}`,
            certificateIds: ids
          });
        }
      }
    });
    
    return duplicates;
  }

  async updateStatus(id: string, status: CertificateStatus): Promise<Certificate> {
    const now = new Date().toISOString();
    await db.run(`
      UPDATE certificates SET status = ?, updated_at = ? WHERE id = ?
    `, [status, now, id]);
    
    return this.findById(id);
  }

  async updateOwner(id: string, ownerName?: string, ownerEmail?: string, ownerId?: string): Promise<Certificate> {
    const now = new Date().toISOString();
    await db.run(`
      UPDATE certificates 
      SET owner_name = ?, owner_email = ?, owner_id = ?, updated_at = ? 
      WHERE id = ?
    `, [ownerName || null, ownerEmail || null, ownerId || null, now, id]);
    
    return this.findById(id);
  }

  async mergeCertificates(primaryId: string, duplicateIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    
    for (const dupId of duplicateIds) {
      if (dupId !== primaryId) {
        await db.run(`
          UPDATE certificates 
          SET status = ?, updated_at = ?, notes = COALESCE(notes, '') || ? 
          WHERE id = ?
        `, [
          CertificateStatus.MERGED, 
          now, 
          `\n已合并到证书 ${primaryId}`, 
          dupId
        ]);
      }
    }
    
    const mergeId = generateId();
    await db.run(`
      INSERT INTO duplicates (id, primary_certificate_id, duplicate_certificate_ids, merged_at)
      VALUES (?, ?, ?, ?)
    `, [mergeId, primaryId, duplicateIds.join(','), now]);
  }

  async countByStatus(): Promise<{ status: string; count: number }[]> {
    return await db.all(`
      SELECT status, COUNT(*) as count 
      FROM certificates 
      GROUP BY status
    `);
  }

  async countByType(): Promise<{ type: string; count: number }[]> {
    return await db.all(`
      SELECT type, COUNT(*) as count 
      FROM certificates 
      WHERE status != ?
      GROUP BY type
    `, [CertificateStatus.MERGED]);
  }
}

export default new CertificateRepository();
