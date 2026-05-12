"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleEngine = void 0;
const crypto_1 = require("crypto");
class RuleEngine {
    constructor() {
        this.EXPIRING_SOON_DAYS = 30;
        this.IMMEDIATE_DAYS = 7;
    }
    calculateDaysUntilExpiry(notAfter) {
        const expiryDate = new Date(notAfter);
        const now = new Date();
        const diffMs = expiryDate.getTime() - now.getTime();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
    determineCertificateStatus(cert) {
        if (cert.status === 'completed' || cert.status === 'rolled_back' || cert.status === 'failed') {
            return cert.status;
        }
        const days = this.calculateDaysUntilExpiry(cert.notAfter);
        if (days <= 0)
            return 'expired';
        if (days <= this.IMMEDIATE_DAYS)
            return 'expiring_soon';
        if (days <= this.EXPIRING_SOON_DAYS)
            return 'expiring_soon';
        return 'active';
    }
    checkSameCertificateMultipleDomains(cert) {
        const issues = [];
        if (cert.domains.length > 1) {
            issues.push(`证书覆盖 ${cert.domains.length} 个域名，需确保所有服务同步更新`);
        }
        return issues;
    }
    checkProductionNoWindow(cert, windows) {
        const issues = [];
        if (cert.environment === 'production') {
            const hasWindow = windows.some(w => w.affectedCertificates.includes(cert.id) &&
                w.status === 'scheduled');
            if (!hasWindow) {
                issues.push('生产环境证书需要维护窗口');
            }
        }
        return issues;
    }
    checkDependenciesUnconfirmed(deps) {
        const issues = [];
        const unconfirmed = deps.filter(d => d.status === 'pending_notification' || d.status === 'notified');
        if (unconfirmed.length > 0) {
            issues.push(`${unconfirmed.length} 个依赖服务未确认`);
        }
        return issues;
    }
    checkRollbackPackageMissing(cert) {
        const issues = [];
        if (!cert.hasRollbackPackage) {
            issues.push('缺少回滚包');
        }
        return issues;
    }
    checkDuplicateRecords(certificates) {
        const duplicates = new Map();
        const seenSerials = new Map();
        for (const cert of certificates) {
            if (seenSerials.has(cert.serialNumber)) {
                const existing = seenSerials.get(cert.serialNumber);
                existing.push(cert.name);
                duplicates.set(cert.serialNumber, existing);
            }
            else {
                seenSerials.set(cert.serialNumber, [cert.name]);
            }
        }
        return duplicates;
    }
    needsCoordination(cert, deps, windows) {
        if (cert.environment === 'production') {
            const hasWindow = windows.some(w => w.affectedCertificates.includes(cert.id) && w.status === 'scheduled');
            if (!hasWindow)
                return true;
        }
        const hasUnconfirmedCritical = deps.some(d => d.isCritical && (d.status === 'pending_notification' || d.status === 'notified'));
        if (hasUnconfirmedCritical)
            return true;
        if (!cert.hasRollbackPackage)
            return true;
        return false;
    }
    generateIdempotencyKey(action, targetId, timestamp) {
        const ts = timestamp || Date.now().toString();
        const input = `${action}:${targetId}:${ts}`;
        return (0, crypto_1.createHash)('sha256').update(input).digest('hex');
    }
    validateCertificate(cert) {
        const errors = [];
        if (!cert.serialNumber) {
            errors.push('缺少序列号');
        }
        if (!cert.notAfter) {
            errors.push('缺少过期时间');
        }
        if (!cert.domains || cert.domains.length === 0) {
            errors.push('缺少域名列表');
        }
        if (!cert.environment) {
            errors.push('缺少环境信息');
        }
        return errors;
    }
    canRotate(cert, deps, windows) {
        const reasons = [];
        if (cert.status === 'completed') {
            return { canRotate: false, reasons: ['证书已完成轮换'] };
        }
        if (cert.environment === 'production') {
            const hasActiveWindow = windows.some(w => w.affectedCertificates.includes(cert.id) &&
                (w.status === 'scheduled' || w.status === 'in_progress'));
            if (!hasActiveWindow) {
                reasons.push('生产环境需要维护窗口');
            }
        }
        const criticalDeps = deps.filter(d => d.isCritical);
        const unacknowledged = criticalDeps.filter(d => d.status !== 'acknowledged' && d.status !== 'not_required');
        if (unacknowledged.length > 0) {
            reasons.push(`${unacknowledged.length} 个关键依赖未确认`);
        }
        if (!cert.hasRollbackPackage) {
            reasons.push('缺少回滚包');
        }
        return {
            canRotate: reasons.length === 0,
            reasons
        };
    }
    analyzeCertificate(cert, deps, windows, allCerts) {
        const issues = [];
        const warnings = [];
        issues.push(...this.checkSameCertificateMultipleDomains(cert));
        issues.push(...this.checkProductionNoWindow(cert, windows));
        issues.push(...this.checkDependenciesUnconfirmed(deps));
        issues.push(...this.checkRollbackPackageMissing(cert));
        const duplicates = this.checkDuplicateRecords(allCerts);
        if (duplicates.has(cert.serialNumber)) {
            const dups = duplicates.get(cert.serialNumber);
            if (dups.length > 1) {
                issues.push(`序列号重复: ${dups.join(', ')}`);
            }
        }
        const validationErrors = this.validateCertificate(cert);
        if (validationErrors.length > 0) {
            issues.push(...validationErrors);
        }
        const daysUntilExpiry = this.calculateDaysUntilExpiry(cert.notAfter);
        const status = this.determineCertificateStatus(cert);
        const hasMaintenanceWindow = windows.some(w => w.affectedCertificates.includes(cert.id));
        if (daysUntilExpiry <= this.IMMEDIATE_DAYS && daysUntilExpiry > 0) {
            warnings.push(`证书将在 ${daysUntilExpiry} 天后过期，需要立即处理`);
        }
        const dependencyInfo = deps.map(d => ({
            serviceName: d.serviceName,
            status: d.status,
            isCritical: d.isCritical
        }));
        return {
            certificateId: cert.id,
            certificateName: cert.name,
            environment: cert.environment,
            domains: [...cert.domains],
            daysUntilExpiry,
            status,
            issues,
            warnings,
            dependencies: dependencyInfo,
            hasMaintenanceWindow,
            hasRollbackPackage: cert.hasRollbackPackage
        };
    }
}
exports.RuleEngine = RuleEngine;
