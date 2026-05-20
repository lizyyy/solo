"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Certificate_1 = __importStar(require("../models/Certificate"));
const Application_1 = __importDefault(require("../models/Application"));
const dayjs_1 = __importDefault(require("dayjs"));
class CertificateService {
    async addCertificate(applicationId, certificateNo, type, version, issueDate, expiryDate, attachmentUrl) {
        const status = this.calculateStatus(expiryDate);
        const certificate = await Certificate_1.default.create({
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
    calculateStatus(expiryDate) {
        const now = (0, dayjs_1.default)();
        const expiry = (0, dayjs_1.default)(expiryDate);
        if (expiry.isBefore(now)) {
            return Certificate_1.CertificateStatus.EXPIRED;
        }
        if (expiry.diff(now, 'day') <= 30) {
            return Certificate_1.CertificateStatus.EXPIRING_SOON;
        }
        return Certificate_1.CertificateStatus.VALID;
    }
    async getCertificatesByApplication(applicationId) {
        return await Certificate_1.default.findAll({
            where: { applicationId },
            order: [['createdAt', 'DESC']],
        });
    }
    async checkCertificates(applicationId, operator) {
        const certificates = await this.getCertificatesByApplication(applicationId);
        const result = {
            isValid: true,
            issues: [],
        };
        for (const cert of certificates) {
            const status = this.calculateStatus(cert.expiryDate);
            if (status !== Certificate_1.CertificateStatus.VALID) {
                result.isValid = false;
                let readableIssue = '';
                if (status === Certificate_1.CertificateStatus.EXPIRED) {
                    readableIssue = `证照【${cert.type}】已过期，过期日期：${(0, dayjs_1.default)(cert.expiryDate).format('YYYY-MM-DD')}，请立即更新`;
                }
                else if (status === Certificate_1.CertificateStatus.EXPIRING_SOON) {
                    const daysLeft = (0, dayjs_1.default)(cert.expiryDate).diff((0, dayjs_1.default)(), 'day');
                    readableIssue = `证照【${cert.type}】即将过期，剩余 ${daysLeft} 天，过期日期：${(0, dayjs_1.default)(cert.expiryDate).format('YYYY-MM-DD')}，请及时更新`;
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
        const application = await Application_1.default.findByPk(applicationId);
        if (application && certificates.length > 0) {
            const versions = [...new Set(certificates.map(c => c.version).filter(Boolean))].join(',');
            await application.update({ certificateVersion: versions });
        }
        return result;
    }
    async getCertificatesByVersion(version) {
        return await Certificate_1.default.findAll({
            where: { version },
            include: [{ model: Application_1.default, as: 'application' }],
        });
    }
    async updateCertificateStatus() {
        const certificates = await Certificate_1.default.findAll();
        for (const cert of certificates) {
            const status = this.calculateStatus(cert.expiryDate);
            if (cert.status !== status) {
                await cert.update({ status });
            }
        }
    }
}
exports.default = new CertificateService();
