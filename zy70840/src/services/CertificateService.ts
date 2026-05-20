import { Op } from 'sequelize';
import Certificate, { CertificateStatus } from '../models/Certificate';
import Application from '../models/Application';
import dayjs from 'dayjs';

export interface CertificateCheckResult {
  isValid: boolean;
  issues: Array<{
    certificateId: number;
    certificateNo: string;
    type: string;
    issue: string;
    readableIssue: string;
  }>;
}

class CertificateService {
  async addCertificate(
    applicationId: number,
    certificateNo: string,
    type: string,
    version: string,
    issueDate: Date,
    expiryDate: Date,
    attachmentUrl?: string
  ) {
    const status = this.calculateStatus(expiryDate);
    const certificate = await Certificate.create({
      applicationId,
      certificateNo,
      type,
      version,
      issueDate,
      expiryDate,
      status,
      attachmentUrl,
    });
    return certificate;
  }

  calculateStatus(expiryDate: Date): CertificateStatus {
    const now = dayjs();
    const expiry = dayjs(expiryDate);
    
    if (expiry.isBefore(now)) {
      return CertificateStatus.EXPIRED;
    }
    
    if (expiry.diff(now, 'day') <= 30) {
      return CertificateStatus.EXPIRING_SOON;
    }
    
    return CertificateStatus.VALID;
  }

  async getCertificatesByApplication(applicationId: number) {
    return await Certificate.findAll({
      where: { applicationId },
      order: [['createdAt', 'DESC']],
    });
  }

  async checkCertificates(applicationId: number, operator: string): Promise<CertificateCheckResult> {
    const certificates = await this.getCertificatesByApplication(applicationId);
    const result: CertificateCheckResult = {
      isValid: true,
      issues: [],
    };

    for (const cert of certificates) {
      const status = this.calculateStatus(cert.expiryDate);
      
      if (status !== CertificateStatus.VALID) {
        result.isValid = false;
        
        let readableIssue = '';
        if (status === CertificateStatus.EXPIRED) {
          readableIssue = `证照【${cert.type}】已过期，过期日期：${dayjs(cert.expiryDate).format('YYYY-MM-DD')}，请立即更新`;
        } else if (status === CertificateStatus.EXPIRING_SOON) {
          const daysLeft = dayjs(cert.expiryDate).diff(dayjs(), 'day');
          readableIssue = `证照【${cert.type}】即将过期，剩余 ${daysLeft} 天，过期日期：${dayjs(cert.expiryDate).format('YYYY-MM-DD')}，请及时更新`;
        }

        result.issues.push({
          certificateId: cert.id,
          certificateNo: cert.certificateNo,
          type: cert.type,
          issue: status,
          readableIssue,
        });
      }

      await cert.update({
        status,
        checkedAt: new Date(),
        checkedBy: operator,
      });
    }

    const application = await Application.findByPk(applicationId);
    if (application && certificates.length > 0) {
      const versions = [...new Set(certificates.map(c => c.version).filter(Boolean))].join(',');
      await application.update({ certificateVersion: versions });
    }

    return result;
  }

  async getCertificatesByVersion(version: string) {
    return await Certificate.findAll({
      where: { version },
      include: [{ model: Application, as: 'application' }],
    });
  }

  async updateCertificateStatus() {
    const certificates = await Certificate.findAll();
    for (const cert of certificates) {
      const status = this.calculateStatus(cert.expiryDate);
      if (cert.status !== status) {
        await cert.update({ status });
      }
    }
  }
}

export default new CertificateService();
