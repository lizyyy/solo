import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { CertInfo } from './types';

export class CertChecker {
  private opensslAvailable: boolean;

  constructor() {
    this.opensslAvailable = this.checkOpensslAvailable();
  }

  private checkOpensslAvailable(): boolean {
    try {
      execSync('openssl version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  checkCertificate(certPath: string): CertInfo {
    const result: CertInfo = {
      path: certPath,
      exists: false,
      isValid: false,
      domains: []
    };

    if (!fs.existsSync(certPath)) {
      result.error = '证书文件不存在';
      return result;
    }

    result.exists = true;

    if (!this.opensslAvailable) {
      result.error = '未检测到 openssl，无法解析证书内容';
      return result;
    }

    try {
      const certContent = fs.readFileSync(certPath, 'utf-8');
      const certInfo = this.parseCertificate(certContent);

      Object.assign(result, certInfo);
      result.isValid = true;

      if (result.validTo) {
        const now = new Date();
        const diffTime = result.validTo.getTime() - now.getTime();
        result.daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    } catch (error) {
      result.error = `证书解析失败: ${error instanceof Error ? error.message : String(error)}`;
    }

    return result;
  }

  private parseCertificate(certContent: string): Partial<CertInfo> {
    const tempFile = path.join('/tmp', `cert-${Date.now()}.pem`);
    fs.writeFileSync(tempFile, certContent);

    try {
      const result: Partial<CertInfo> = {
        domains: []
      };

      const textOutput = execSync(`openssl x509 -in "${tempFile}" -text -noout`, {
        encoding: 'utf-8'
      });

      const subjectMatch = textOutput.match(/Subject:\s*(.+)/);
      if (subjectMatch) {
        result.subject = subjectMatch[1].trim();
      }

      const issuerMatch = textOutput.match(/Issuer:\s*(.+)/);
      if (issuerMatch) {
        result.issuer = issuerMatch[1].trim();
      }

      const notBeforeMatch = textOutput.match(/Not Before:\s*(.+)/);
      if (notBeforeMatch) {
        result.validFrom = this.parseOpenSSLDate(notBeforeMatch[1].trim());
      }

      const notAfterMatch = textOutput.match(/Not After\s*:\s*(.+)/);
      if (notAfterMatch) {
        result.validTo = this.parseOpenSSLDate(notAfterMatch[1].trim());
      }

      const domains: string[] = [];

      const cnMatch = result.subject?.match(/CN\s*=\s*([^,\s]+)/);
      if (cnMatch && cnMatch[1] && !cnMatch[1].startsWith('*')) {
        domains.push(cnMatch[1].replace(/^\*\./, ''));
      }

      const sanMatch = textOutput.match(/X509v3 Subject Alternative Name:[\s\S]*?DNS:([^\n]+)/);
      if (sanMatch) {
        const sanDomains = sanMatch[1]
          .split(/,?\s*DNS:/)
          .map(d => d.trim())
          .filter(d => d && !d.startsWith('*'))
          .map(d => d.replace(/^\*\./, ''));
        domains.push(...sanDomains);
      }

      result.domains = [...new Set(domains)];

      return result;
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  private parseOpenSSLDate(dateStr: string): Date {
    const months: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };

    const match = dateStr.match(/(\w+)\s+(\d+)\s+(\d+):(\d+):(\d+)\s+(\d+)\s+GMT/);
    if (match) {
      const [, month, day, hour, minute, second, year] = match;
      return new Date(
        Date.UTC(
          parseInt(year),
          months[month] || 0,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        )
      );
    }

    return new Date(dateStr);
  }
}
